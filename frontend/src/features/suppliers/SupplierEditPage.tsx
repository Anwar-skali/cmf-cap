import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';
import { useSupplierQuery } from '@/hooks/queries/useSuppliersQuery';
import { useUpdateSupplierMutation } from '@/hooks/mutations/useSupplierMutations';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { createSupplierSchema, type CreateSupplierFormData } from '@/utils/validators';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import type { CreateSupplierRequest } from '@/types';

export default function SupplierEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const updateSupplier = useUpdateSupplierMutation();

  const { data: supplier, isLoading, error, refetch } = useSupplierQuery(id!);

  if (error) return <ErrorState title="Failed to load supplier" message={error?.message} onRetry={refetch} />;
  if (!supplier) return isLoading ? null : <EmptyState title="Supplier not found" description="The supplier you are trying to edit does not exist." />;

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
  }, [supplier, form]);

  const onSubmit = (formData: CreateSupplierFormData) => {
    updateSupplier.mutate(
      { id: id!, data: formData as unknown as CreateSupplierRequest },
      { onSuccess: () => navigate('/suppliers') },
    );
  };

  if (isLoading) {
    return <LoadingSpinner className="min-h-[300px]" label="Loading supplier..." />;
  }

  return (
    <div>
      <PageHeader title="Edit Supplier" description="Update supplier information">
        <Button variant="outline" onClick={() => navigate('/suppliers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input placeholder="Supplier name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl><Input placeholder="Supplier code" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contactPerson" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl><Input placeholder="Contact name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="contact@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input placeholder="+1234567890" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="website" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl><Input placeholder="https://example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl><Input placeholder="Street, City" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="blacklisted">Blacklisted</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={4} placeholder="Additional notes..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => navigate('/suppliers')}>
                  Cancel
                </Button>
                <Button type="submit" loading={updateSupplier.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
