import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Building2 } from 'lucide-react';
import { useSupplierQuery } from '@/hooks/queries/useSuppliersQuery';
import { useUpdateSupplierMutation } from '@/hooks/mutations/useSupplierMutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { createSupplierSchema, type CreateSupplierFormData } from '@/utils/validators';
import { ErrorState } from '@/components/ui/error-state';
import { Badge } from '@/components/ui/badge';
import type { CreateSupplierRequest } from '@/types';

export default function SupplierEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const updateSupplier = useUpdateSupplierMutation();

  const { data: supplier, isLoading, error, refetch } = useSupplierQuery(id!);

  // ✅ All hooks declared BEFORE any conditional returns
  const form = useForm<CreateSupplierFormData>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      name: '',
      code: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      website: '',
      status: 'active',
      notes: '',
    },
  });

  // Populate form once supplier loads
  useEffect(() => {
    if (supplier) {
      form.reset({
        name: supplier.name,
        code: supplier.code,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone ?? '',
        address: supplier.address ?? '',
        website: supplier.website ?? '',
        status: supplier.status,
        notes: supplier.notes ?? '',
      });
    }
  }, [supplier]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conditional renders AFTER all hooks ─────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load supplier"
        message={error?.message ?? 'The supplier could not be loaded.'}
        onRetry={refetch}
      />
    );
  }

  if (!supplier) {
    return (
      <ErrorState
        title="Supplier not found"
        message="The supplier you are trying to edit does not exist or has been removed."
        onRetry={() => navigate('/suppliers')}
      />
    );
  }

  const onSubmit = (formData: CreateSupplierFormData) => {
    updateSupplier.mutate(
      { id: id!, data: formData as unknown as CreateSupplierRequest },
      { onSuccess: () => navigate('/suppliers') },
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="rounded-xl">
            <Link to="/suppliers">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Suppliers
            </Link>
          </Button>
          <div className="h-4 w-[1px] bg-border hidden sm:block" />
          <Badge variant="outline" className="text-xs font-bold text-amber-600 border-amber-500/20 bg-amber-500/10">
            Editing Vendor Profile
          </Badge>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-mono font-bold text-muted-foreground uppercase">VENDOR CODE: {supplier.code}</p>
          <h1 className="text-xl font-black tracking-tight text-foreground">{supplier.name}</h1>
        </div>
      </div>

      {/* Edit Form Card */}
      <Card className="rounded-2xl border-border shadow-xs">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base font-extrabold">Supplier Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold">Supplier Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Renault Supplier SA" className="rounded-xl h-10 text-xs" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold">Vendor Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. SUP-0042" className="rounded-xl h-10 text-xs font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="contactPerson" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold">Primary Contact</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact full name" className="rounded-xl h-10 text-xs" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold">Email Address *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@supplier.com" className="rounded-xl h-10 text-xs" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold">Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+33 1 23 45 67 89" className="rounded-xl h-10 text-xs" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="website" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold">Official Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://supplier.com" className="rounded-xl h-10 text-xs" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel className="text-xs font-bold">Manufacturing / Site Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Street, City, Country" className="rounded-xl h-10 text-xs" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold">Vendor Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? 'active'}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl h-10 text-xs">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="active" className="text-xs">✅ Active — Approved for production</SelectItem>
                        <SelectItem value="inactive" className="text-xs">⏸ Inactive — Suspended / Paused</SelectItem>
                        <SelectItem value="blacklisted" className="text-xs">🚫 Blacklisted — Flagged / Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold">Procurement Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Quality audit notes, sourcing remarks, certifications, etc."
                      className="rounded-xl text-xs resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate('/suppliers')}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateSupplier.isPending}
                  className="rounded-xl text-xs font-bold bg-[#0066CC] hover:bg-[#0052A3] text-white shadow-md shadow-blue-500/20 gap-1.5 px-5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {updateSupplier.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
