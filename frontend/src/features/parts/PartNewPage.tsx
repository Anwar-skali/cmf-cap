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
      apqp: '',
      supplierId: '',
      manufacturingCofor: '',
      useCase: '',
      quantity: 1,
      unit: 'pcs',
      material: '',
      status: 'active',
      description: '',
      comments: '',
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
              <p className="text-xs text-muted-foreground">Fill in the part details below according to CMF standards.</p>
            </div>

            {/* Row 1: Part Name & Part Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Part Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Front Bumper LH" {...field} /></FormControl>
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
                    <FormControl><Input placeholder="e.g. PN-994821" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 2: Project & APQP */}
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
                name="apqp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>APQP</FormLabel>
                    <FormControl><Input placeholder="e.g. APQP-Phase-2" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 3: Supplier & Manufacturing COFOR (same line) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="manufacturingCofor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturing COFOR</FormLabel>
                    <FormControl><Input placeholder="e.g. COFOR-12948" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 4: Use Case, Quantity & Material */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="useCase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Use Case</FormLabel>
                    <FormControl><Input placeholder="e.g. Mass Production EV Line" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        onChange={(e) => field.onChange(Number(e.target.value) || 1)}
                      />
                    </FormControl>
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
                    <FormControl><Input placeholder="e.g. Plastic, Aluminum, Steel" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 5: Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* Row 6: Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Technical specifications and part notes..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 7: Comments & Commercial Notes */}
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments & Commercial Notes</FormLabel>
                  <FormControl><Textarea placeholder="Commercial reference, commitment dates, or purchasing observations..." {...field} /></FormControl>
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
                <span>{createMutation.isPending ? 'Creating...' : 'Create Part'}</span>
              </button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

