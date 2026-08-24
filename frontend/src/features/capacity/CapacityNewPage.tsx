import { useEffect, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useCreateCapacityMutation, useUpdateCapacityMutation } from '@/hooks/mutations/useCapacityMutations';
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
  Layers,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Gauge,
  Cpu,
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
  HelpCircle,
  FileCheck,
  TrendingUp,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { createCapacityAssessmentSchema, type CreateCapacityAssessmentFormData } from '@/utils/validators';
import type { CreateCapacityAssessmentRequest, CapacityAssessment } from '@/types';
import { useToast } from '@/hooks/useToast';

export default function CapacityNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const prefillData = (location.state as { prefill?: CapacityAssessment })?.prefill;
  const isEditing = !!prefillData?.id;

  const createMutation = useCreateCapacityMutation();
  const updateMutation = useUpdateCapacityMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const { data: partsData, isLoading: isLoadingParts } = usePartsQuery();
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useSuppliersQuery();

  const currentDate = new Date();
  const form = useForm<CreateCapacityAssessmentFormData>({
    resolver: zodResolver(createCapacityAssessmentSchema),
    defaultValues: {
      month: prefillData?.month ?? currentDate.getMonth() + 1,
      year: prefillData?.year ?? currentDate.getFullYear(),
      currentCapacity: prefillData?.currentCapacity ?? 1000,
      maximumCapacity: prefillData?.maximumCapacity ?? 1250,
      projectPartId: prefillData?.projectPartId ?? '',
      supplierId: prefillData?.supplierId ?? '',
      cate: prefillData?.cate ?? 'CATE 1',
      gate: prefillData?.gate ?? 'Gate 1 (M1)',
      targetWeek: prefillData?.targetWeek ?? '202624',
      forecastWeek: prefillData?.forecastWeek ?? '202624',
      completedWeek: prefillData?.completedWeek ?? '',
      riskLevel: prefillData?.riskLevel ?? 'low',
      assessmentDate: prefillData?.assessmentDate
        ? prefillData.assessmentDate.split('T')[0]
        : currentDate.toISOString().split('T')[0],
      leadTimeDays: prefillData?.leadTimeDays ?? 7,
      bottleneck: prefillData?.bottleneck ?? '',
      notes: prefillData?.notes ?? '',
      status: prefillData?.status ?? 'pending',
    },
  });

  // Watch fields for live capacity calculation gauge
  const currentCap = form.watch('currentCapacity');
  const maxCap = form.watch('maximumCapacity');
  const selectedPartId = form.watch('projectPartId');
  const selectedSupplierId = form.watch('supplierId');
  const selectedRisk = form.watch('riskLevel');
  const selectedStatus = form.watch('status');

  // Compute live utilization percentage & headroom
  const liveUtilization = useMemo(() => {
    const cur = Number(currentCap) || 0;
    const max = Number(maxCap) || 0;
    if (max <= 0) return 0;
    return Math.round((cur / max) * 100);
  }, [currentCap, maxCap]);

  const headroom = useMemo(() => {
    const cur = Number(currentCap) || 0;
    const max = Number(maxCap) || 0;
    return Math.max(0, max - cur);
  }, [currentCap, maxCap]);

  // Selected part & supplier info
  const selectedPart = useMemo(
    () => partsData?.items?.find((p) => p.id === selectedPartId),
    [partsData, selectedPartId],
  );
  const selectedSupplier = useMemo(
    () => suppliersData?.items?.find((s) => s.id === selectedSupplierId),
    [suppliersData, selectedSupplierId],
  );

  const onSubmit = (data: CreateCapacityAssessmentFormData) => {
    if (isEditing && prefillData?.id) {
      updateMutation.mutate(
        { id: prefillData.id, data: data as Partial<CreateCapacityAssessmentRequest> },
        {
          onSuccess: () => {
            navigate(`/capacity/${prefillData.id}`);
          },
          onError: (err) => toast.error(err?.message || 'Failed to update assessment'),
        },
      );
    } else {
      createMutation.mutate(data as CreateCapacityAssessmentRequest, {
        onSuccess: () => {
          navigate('/capacity');
        },
        onError: (err) => toast.error(err?.message || 'Failed to create assessment'),
      });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 p-6 rounded-2xl border border-border/60 shadow-soft backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild className="h-10 w-10 shrink-0 rounded-xl">
            <Link to="/capacity">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold px-2.5 py-0.5 text-xs">
                {isEditing ? 'Edit Assessment' : 'New Industrial Audit'}
              </Badge>
              <Badge variant="secondary" className="text-[11px] font-mono">
                CMF Engine v2.4
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Gauge className="h-7 w-7 text-primary shrink-0" />
              {isEditing ? `Edit Capacity Assessment #${prefillData.id.slice(0, 8)}` : 'New Capacity Assessment'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Evaluate production line sizing, supplier capacity constraints, CATE milestone readiness, and line bottlenecks
            </p>
          </div>
        </div>
      </div>

      {/* ── Live Capacity Engine Preview Banner ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Step 1: Component & Supplier Identification */}
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      Component & Supplier Assignment
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground font-mono">
                      Step 1 of 5
                    </Badge>
                  </div>
                  <CardDescription className="text-xs pt-1">
                    Select the target automotive component and the assigned manufacturing supplier plant
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField
                      control={form.control}
                      name="projectPartId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <Cpu className="h-3.5 w-3.5 text-primary" /> Project Component / Part *
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <FormControl>
                              <SelectTrigger className="h-10 bg-background/80">
                                <SelectValue placeholder={isLoadingParts ? 'Loading parts...' : 'Select component'} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {partsData?.items?.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="font-semibold">{p.name}</span>{' '}
                                  <span className="font-mono text-xs text-muted-foreground">({p.partNumber})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-[11px]">
                            {selectedPart ? `Selected: ${selectedPart.name} (${selectedPart.partNumber})` : 'Select the part being audited'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-primary" /> Manufacturing Supplier *
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <FormControl>
                              <SelectTrigger className="h-10 bg-background/80">
                                <SelectValue placeholder={isLoadingSuppliers ? 'Loading suppliers...' : 'Select supplier'} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {suppliersData?.items?.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  <span className="font-semibold">{s.name}</span>{' '}
                                  {s.code && <span className="font-mono text-xs text-muted-foreground">(COFOR: {s.code})</span>}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-[11px]">
                            {selectedSupplier
                              ? `Selected: ${selectedSupplier.name} ${selectedSupplier.code ? `[COFOR ${selectedSupplier.code}]` : ''}`
                              : 'Select manufacturing site'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Step 2: CATE & Evaluation Status */}
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                      <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      CATE Classification, Status & Risk Level
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground font-mono">
                      Step 2 of 5
                    </Badge>
                  </div>
                  <CardDescription className="text-xs pt-1">
                    Set CATE category tier, validation lifecycle status, and evaluated line risk severity
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <FormField
                      control={form.control}
                      name="cate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-purple-600" /> CATE Tier *
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? 'CATE 1'}>
                            <FormControl>
                              <SelectTrigger className="h-10 bg-background/80">
                                <SelectValue placeholder="Select CATE" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CATE 1">CATE 1 (Critical Safety)</SelectItem>
                              <SelectItem value="CATE 2">CATE 2 (Major Functional)</SelectItem>
                              <SelectItem value="CATE 3">CATE 3 (Standard Component)</SelectItem>
                              <SelectItem value="CATE 4">CATE 4 (Minor Parts)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Validation Status *
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? 'pending'}>
                            <FormControl>
                              <SelectTrigger className="h-10 bg-background/80">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pending">Pending Review</SelectItem>
                              <SelectItem value="assessed">Assessed (In Progress)</SelectItem>
                              <SelectItem value="confirmed">Confirmed (Validated OK)</SelectItem>
                              <SelectItem value="rejected">Rejected / Non-Compliant</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="riskLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Capacity Risk Level
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? 'low'}>
                            <FormControl>
                              <SelectTrigger className="h-10 bg-background/80">
                                <SelectValue placeholder="Select risk level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low Risk (Compliant)</SelectItem>
                              <SelectItem value="medium">Medium Risk (Watchlist)</SelectItem>
                              <SelectItem value="high">High Risk (Bottleneck)</SelectItem>
                              <SelectItem value="critical">Critical Risk (Line Stoppage)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Step 3: Capacity Volumes & Target Period */}
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                      Capacity Volumes & Target Period
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground font-mono">
                      Step 3 of 5
                    </Badge>
                  </div>
                  <CardDescription className="text-xs pt-1">
                    Quantify required monthly production volume against maximum installed supplier throughput
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                    <FormField
                      control={form.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Audit Month (1-12) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={12}
                              className="h-10 bg-background/80 font-mono"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Audit Year *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={2000}
                              max={2100}
                              className="h-10 bg-background/80 font-mono"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currentCapacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Required Capacity (pcs/mo) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              className="h-10 bg-background/80 font-mono font-bold text-foreground"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription className="text-[11px]">Monthly demand volume</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maximumCapacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Installed Max Capacity (pcs/mo) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              className="h-10 bg-background/80 font-mono font-bold text-primary"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription className="text-[11px]">Supplier max throughput</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Step 4: Milestone Dates & Calendar Weeks */}
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                        4
                      </div>
                      Milestone Calendar Tracking & Lead Time
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground font-mono">
                      Step 4 of 5
                    </Badge>
                  </div>
                  <CardDescription className="text-xs pt-1">
                    Log assessment date and track target, forecast, and actual completion calendar weeks
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    <FormField
                      control={form.control}
                      name="assessmentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Assessment Date</FormLabel>
                          <FormControl>
                            <Input type="date" className="h-10 bg-background/80 text-xs" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="targetWeek"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Target Week</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 202624" className="h-10 bg-background/80 font-mono text-xs" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="forecastWeek"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Forecast Week</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 202624" className="h-10 bg-background/80 font-mono text-xs" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="completedWeek"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Completed Week</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 202624" className="h-10 bg-background/80 font-mono text-xs" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="leadTimeDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Lead Time (Days)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              className="h-10 bg-background/80 font-mono text-xs"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Step 5: Bottleneck & Action Plan */}
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                      <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm">
                        5
                      </div>
                      Bottleneck Analysis & Action Plan
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground font-mono">
                      Step 5 of 5
                    </Badge>
                  </div>
                  <CardDescription className="text-xs pt-1">
                    Document identified industrial constraints, tooling bottlenecks, and supplier action items
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <FormField
                    control={form.control}
                    name="bottleneck"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Constraint / Bottleneck Description</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. CNC Machine Tooling Shortage, SMT Line 2 Shift Capacity, Injection Mold Cycle Time..."
                            className="h-10 bg-background/80"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Mitigation Remarks & Action Items</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Detail audit findings, shift additions, supplier tooling plan, and line recovery target date..."
                            rows={3}
                            className="bg-background/80"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* ── Action Buttons ── */}
              <div className="flex items-center justify-between pt-4 border-t border-border/60">
                <Button variant="outline" type="button" asChild>
                  <Link to="/capacity">Cancel & Exit</Link>
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm font-semibold px-6"
                >
                  <Save className="h-4 w-4" />
                  {isPending
                    ? isEditing
                      ? 'Updating Assessment...'
                      : 'Saving Assessment...'
                    : isEditing
                    ? 'Update Capacity Assessment'
                    : 'Save Capacity Assessment'}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* ── Live Capacity Engine Preview Sidebar ── */}
        <div className="space-y-6">
          <Card className="border-border/60 shadow-soft sticky top-6 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" /> Live Calculation Gauge
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time CMF platform capacity calculation engine response
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Utilization Gauge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5 text-primary" /> Fleet Utilization
                  </span>
                  <span
                    className={`font-mono font-bold text-base ${
                      liveUtilization >= 95
                        ? 'text-rose-600 dark:text-rose-400'
                        : liveUtilization >= 80
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {liveUtilization}%
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      liveUtilization >= 95
                        ? 'bg-rose-500'
                        : liveUtilization >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(liveUtilization, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {liveUtilization >= 95
                    ? '⚠️ Severe bottleneck overload (≥95%). Line stoppage risk.'
                    : liveUtilization >= 80
                    ? '⚡ High capacity utilization (80-94%). Monitor closely.'
                    : '✅ Healthy headroom available (<80%). Safe margin.'}
                </p>
              </div>

              {/* Volume Breakdown */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl border bg-muted/30 space-y-1">
                  <p className="text-[11px] text-muted-foreground font-medium">Required Demand</p>
                  <p className="text-base font-bold font-mono text-foreground">
                    {Number(currentCap || 0).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">pcs</span>
                  </p>
                </div>

                <div className="p-3 rounded-xl border bg-muted/30 space-y-1">
                  <p className="text-[11px] text-muted-foreground font-medium">Max Capability</p>
                  <p className="text-base font-bold font-mono text-primary">
                    {Number(maxCap || 0).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">pcs</span>
                  </p>
                </div>
              </div>

              {/* Remaining Headroom */}
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" /> Remaining Headroom
                  </span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    +{headroom.toLocaleString()} pcs
                  </span>
                </div>
                <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400">
                  Unallocated monthly buffer available for surge volume
                </p>
              </div>

              {/* Selection Summary */}
              <div className="space-y-2 pt-2 border-t text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Target Component:</span>
                  <span className="font-medium text-foreground truncate max-w-[150px]">
                    {selectedPart?.name || 'Not selected'}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Manufacturing Plant:</span>
                  <span className="font-medium text-foreground truncate max-w-[150px]">
                    {selectedSupplier?.name || 'Not selected'}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Evaluated Risk:</span>
                  <Badge variant="outline" className="capitalize text-[10px] py-0 px-2">
                    {selectedRisk || 'low'}
                  </Badge>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Status:</span>
                  <Badge variant="outline" className="capitalize text-[10px] py-0 px-2">
                    {selectedStatus || 'pending'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
