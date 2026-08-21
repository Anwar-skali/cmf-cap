import { useNavigate, Link } from 'react-router-dom';
import { useCreateCapacityMutation } from '@/hooks/mutations/useCapacityMutations';
import { usePartsQuery } from '@/hooks/queries/usePartsQuery';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Save, Layers, Calendar, AlertTriangle, ShieldCheck, Gauge } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { createCapacityAssessmentSchema, type CreateCapacityAssessmentFormData } from '@/utils/validators';
import type { CreateCapacityAssessmentRequest } from '@/types';
import { useToast } from '@/hooks/useToast';

export default function CapacityNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createMutation = useCreateCapacityMutation();
  const { data: partsData, isLoading: isLoadingParts } = usePartsQuery();
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useSuppliersQuery();

  const currentDate = new Date();
  const form = useForm<CreateCapacityAssessmentFormData>({
    resolver: zodResolver(createCapacityAssessmentSchema),
    defaultValues: {
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear(),
      currentCapacity: 100,
      maximumCapacity: 150,
      projectPartId: '',
      supplierId: '',
      gate: 'Gate 1 (M1)',
      targetWeek: '202624',
      forecastWeek: '202624',
      completedWeek: '',
      riskLevel: 'low',
      assessmentDate: currentDate.toISOString().split('T')[0],
      leadTimeDays: 7,
      bottleneck: '',
      notes: '',
      status: 'pending',
    },
  });

  const onSubmit = (data: CreateCapacityAssessmentFormData) => {
    createMutation.mutate(data as CreateCapacityAssessmentRequest, {
      onSuccess: () => {
        toast.success('Capacity assessment created successfully');
        navigate('/capacity');
      },
      onError: (err) => toast.error(err?.message || 'Failed to create capacity assessment'),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/capacity"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Capacity Assessment</h1>
          <p className="text-muted-foreground">Perform, log, and track a supplier industrial capacity assessment with milestone gates</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Section 1: Part & Supplier Identification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> 1. Component & Supplier Assignment
              </CardTitle>
              <CardDescription>Select the automotive project component and the responsible manufacturing supplier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="projectPartId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Component / Part *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingParts ? 'Loading parts...' : 'Select component'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {partsData?.items?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.partNumber})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingSuppliers ? 'Loading suppliers...' : 'Select supplier'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliersData?.items?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} {s.code ? `(COFOR: ${s.code})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: CATE, Status & Risk */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" /> 2. CATE, Status & Risk Level
              </CardTitle>
              <CardDescription>Define the CATE category and evaluation status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="cate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CATE *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? 'CATE 1'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select CATE" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CATE 1">CATE 1</SelectItem>
                          <SelectItem value="CATE 2">CATE 2</SelectItem>
                          <SelectItem value="CATE 3">CATE 3</SelectItem>
                          <SelectItem value="CATE 4">CATE 4</SelectItem>
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
                      <FormLabel>Assessment Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? 'pending'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending Review</SelectItem>
                          <SelectItem value="assessed">Assessed (In Progress)</SelectItem>
                          <SelectItem value="confirmed">Confirmed (Validated OK)</SelectItem>
                          <SelectItem value="rejected">Rejected / At Risk</SelectItem>
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
                      <FormLabel>Capacity Risk Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? 'low'}>
                        <FormControl>
                          <SelectTrigger>
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

          {/* Section 3: Capacity Volumes & Period */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" /> 3. Capacity Volumes & Target Period
              </CardTitle>
              <CardDescription>Quantify production volume demand against installed maximum capability</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month (1-12) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={12}
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
                      <FormLabel>Year *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={2000}
                          max={2100}
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
                      <FormLabel>Required Capacity (pcs/mo) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
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
                  name="maximumCapacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Installed Capacity (pcs/mo) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Milestone Calendar Tracking & Lead Time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> 4. Milestone Dates & Calendar Weeks
              </CardTitle>
              <CardDescription>Track evaluation date and milestone target/forecast/completed calendar weeks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                <FormField
                  control={form.control}
                  name="assessmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assessment Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Week (e.g. 202624)</FormLabel>
                      <FormControl><Input placeholder="202624" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="forecastWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forecast Week</FormLabel>
                      <FormControl><Input placeholder="202623" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="completedWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Completed Week</FormLabel>
                      <FormControl><Input placeholder="202624 or leave empty" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="leadTimeDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Time (Days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
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

          {/* Section 5: Bottleneck & Action Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" /> 5. Bottleneck Analysis & Action Plan
              </CardTitle>
              <CardDescription>Document critical bottlenecks, machine tooling constraints, and countermeasures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="bottleneck"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bottleneck Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. CNC Machine Tooling Shortage, SMT Line 2 Shift capacity, Resin injection mold cycle time" {...field} />
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
                    <FormLabel>Mitigation Action Plan & Remarks</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detail assessment findings, supplier action items, machine shift additions, and tooling validation plan..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" asChild><Link to="/capacity">Cancel</Link></Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
              <Save className="h-4 w-4" /> {createMutation.isPending ? 'Saving Assessment...' : 'Save Capacity Assessment'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
