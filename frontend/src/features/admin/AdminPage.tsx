import { Shield } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Admin" description="Platform administration and settings" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-muted-foreground" /> Administration Panel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Administrative tools and settings will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
