import { useNavigate } from 'react-router-dom';
import { useCreatePartMutation } from '@/hooks/mutations/usePartMutations';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CrudFormHeader } from '@/components/layout/CrudFormHeader';
import { Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { createPartSchema, type CreatePartFormData } from '@/utils/validators';
import type { CreateProjectPartRequest } from '@/types';
import { useToast } from '@/hooks/useToast';

export default function PartNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createMutation = useCreatePartMutation();
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

  const onSubmit = (data: CreatePartFormData) => {
    createMutation.mutate(data as CreateProjectPartRequest, {
      onSuccess: () => navigate('/parts'),
      onError: (err) => toast.error(err?.message || 'Failed to create part'),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* LTOS Dark Hero Header Banner */}
      <CrudFormHeader
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Parts & Components', href: '/parts' },
          { label: 'Create Component' },
        ]}
        title="Create Inventory Part Object"
        subtitle="Add a new component, part number, or material specification to project inventory."
        versionBadge="Part Catalog V2026_V1"
      />

      {/* White Floating Container Card */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 sm:p-8 shadow-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Component Specification</h2>
              <p className="text-xs text-muted-foreground">Fill in the part details below.</p>
            </div>

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
                    <FormLabel>Project *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingProjects ? 'Loading projects...' : 'Select project'} />
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

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => navigate('/parts')}
                className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Back
              </button>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-bold px-8 py-2.5 transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{createMutation.isPending ? 'Creating...' : 'Next'}</span>
              </button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

