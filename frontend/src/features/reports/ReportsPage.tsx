import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Reports" description="Generate and view platform reports" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-muted-foreground" /> Reports Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Reporting tools and generated reports will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
