import { useNavigate, Link } from 'react-router-dom';
import { useCreateRiskMutation } from '@/hooks/mutations/useRiskMutations';
import { usePartsQuery } from '@/hooks/queries/usePartsQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { createRiskSchema, type CreateRiskFormData } from '@/utils/validators';
import type { CreateRiskRequest } from '@/types';
import { useToast } from '@/hooks/useToast';

export default function RiskNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const createMutation = useCreateRiskMutation();
  const { data: partsData, isLoading: isLoadingParts } = usePartsQuery();

  const form = useForm<CreateRiskFormData>({
    resolver: zodResolver(createRiskSchema),
    defaultValues: {
      title: '',
      projectPartId: '',
      description: '',
      riskType: 'Technical',
      severity: 'medium',
      probability: 'possible',
      impact: '',
      mitigation: '',
      contingency: '',
      status: 'open',
      dueDate: '',
    },
  });

  const onSubmit = (data: CreateRiskFormData) => {
    createMutation.mutate(data as CreateRiskRequest, {
      onSuccess: () => navigate('/risks'),
      onError: (err) => toast.error(err?.message || 'Failed to create risk'),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/risks"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Risk</h1>
          <p className="text-muted-foreground">Log a new project risk</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Risk Information</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Title *</FormLabel>
                    <FormControl><Input placeholder="Enter risk title" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectPartId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associated Part *</FormLabel>
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Describe the risk" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Severity Level *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="probability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Probability *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select probability" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="rare">Rare</SelectItem>
                          <SelectItem value="unlikely">Unlikely</SelectItem>
                          <SelectItem value="possible">Possible</SelectItem>
                          <SelectItem value="likely">Likely</SelectItem>
                          <SelectItem value="almost_certain">Almost Certain</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="riskType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risk Type</FormLabel>
                      <FormControl><Input placeholder="e.g. Technical, Financial, Schedule" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="impact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Potential Impact</FormLabel>
                      <FormControl><Textarea placeholder="Describe the potential impact" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mitigation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mitigation Plan</FormLabel>
                      <FormControl><Textarea placeholder="Describe steps to mitigate this risk" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Button variant="outline" asChild><Link to="/risks">Cancel</Link></Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" /> {createMutation.isPending ? 'Creating...' : 'Create Risk'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
