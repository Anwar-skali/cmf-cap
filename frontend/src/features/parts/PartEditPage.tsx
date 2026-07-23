import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePartQuery } from '@/hooks/queries/usePartsQuery';
import { useUpdatePartMutation } from '@/hooks/mutations/usePartMutations';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorState } from '@/components/ui/error-state';
import { ArrowLeft, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { createPartSchema, type CreatePartFormData } from '@/utils/validators';
import type { CreateProjectPartRequest } from '@/types';
import { useToast } from '@/hooks/useToast';

export default function PartEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: part, isLoading, error, refetch } = usePartQuery(id!);
  const updateMutation = useUpdatePartMutation();
  const { data: projectsData, isLoading: isLoadingProjects } = useProjectsQuery();
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useSuppliersQuery();

  const form = useForm<CreatePartFormData>({
    resolver: zodResolver(createPartSchema),
    defaultValues: {
      name: '',
      partNumber: '',
      projectId: '',
      supplierId: '',
      quantity: 1,
      unit: 'pcs',
      material: '',
      weight: undefined,
      status: 'active',
      description: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (part) {
      form.reset({
        name: part.name || '',
        partNumber: part.partNumber || '',
        projectId: part.projectId || '',
        supplierId: part.supplierId || '',
        quantity: part.quantity || 1,
        unit: part.unit || 'pcs',
        material: part.material || '',
        weight: part.weight || undefined,
        status: part.status || 'active',
        description: part.description || '',
        notes: part.notes || '',
      });
    }
  }, [part, form]);

  const onSubmit = (data: CreatePartFormData) => {
    updateMutation.mutate(
      { id: id!, data: data as CreateProjectPartRequest },
      {
        onSuccess: () => navigate(`/parts/${id}`),
        onError: (err) => toast.error(err?.message || 'Failed to update part'),
      },
    );
  };

  if (isLoading) {
    return <LoadingSpinner className="min-h-[300px]" label="Loading part details..." />;
  }

  if (error || !part) {
    return (
      <ErrorState
        title="Part not found"
        message={error?.message ?? 'Could not load part details for editing.'}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/parts/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Part</h1>
          <p className="text-muted-foreground">Update details for {part.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Part Details</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Part Name *</FormLabel>
                      <FormControl><Input placeholder="Enter part name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="partNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Part Number *</FormLabel>
                      <FormControl><Input placeholder="e.g. PN-1002" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingProjects ? 'Loading projects...' : 'Select project (optional)'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projectsData?.items?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
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
                      <FormLabel>Supplier</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingSuppliers ? 'Loading suppliers...' : 'Select supplier (optional)'} />
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
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
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

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit *</FormLabel>
                      <FormControl><Input placeholder="e.g. pcs, kg, m" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="material"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material</FormLabel>
                      <FormControl><Input placeholder="e.g. Aluminum, Steel" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 1.25"
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="obsolete">Obsolete</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Part description" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea placeholder="Internal notes or specifications" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Button variant="outline" asChild><Link to={`/parts/${id}`}>Cancel</Link></Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" /> {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
