import { useNavigate, Link } from 'react-router-dom';
import { useCreateCapacityMutation } from '@/hooks/mutations/useCapacityMutations';
import { usePartsQuery } from '@/hooks/queries/usePartsQuery';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
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
      assessmentDate: currentDate.toISOString().split('T')[0],
      leadTimeDays: 7,
      bottleneck: '',
      notes: '',
      status: 'pending',
    },
  });

  const onSubmit = (data: CreateCapacityAssessmentFormData) => {
    createMutation.mutate(data as CreateCapacityAssessmentRequest, {
      onSuccess: () => navigate('/capacity'),
      onError: (err) => toast.error(err?.message || 'Failed to create capacity assessment'),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/capacity"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Capacity Assessment</h1>
          <p className="text-muted-foreground">Perform and log a supplier capacity assessment</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Assessment Details</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="projectPartId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Part *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingParts ? 'Loading parts...' : 'Select part'} />
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
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      <FormLabel>Current Capacity *</FormLabel>
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
                      <FormLabel>Max Capacity *</FormLabel>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="bottleneck"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bottleneck Details</FormLabel>
                    <FormControl><Input placeholder="e.g. CNC Machine Availability, Tooling" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes & Remarks</FormLabel>
                    <FormControl><Textarea placeholder="Detail assessment observations and notes" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Button variant="outline" asChild><Link to="/capacity">Cancel</Link></Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" /> {createMutation.isPending ? 'Creating...' : 'Create Assessment'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
