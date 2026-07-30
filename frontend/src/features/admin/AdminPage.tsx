import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { TemplateManager } from './TemplateManager';

export default function AdminPage() {
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <PageHeader
        title="Admin Module"
        description="Configure template engine, versioning, dynamic schemas, and system settings"
      />
      <TemplateManager />
    </div>
  );
}
