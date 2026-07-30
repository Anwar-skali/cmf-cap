import React, { useState } from 'react';
import { CMFTemplate } from '@/types/template';
import { DynamicForm } from '@/components/template-engine/DynamicForm';
import { X, UserCheck, Eye } from 'lucide-react';

interface TemplatePreviewModalProps {
  template: CMFTemplate;
  onClose: () => void;
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({ template, onClose }) => {
  const [simulatedRole, setSimulatedRole] = useState<string>('admin');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Template Preview: {template.name} ({template.code})
              </h3>
              <p className="text-xs text-muted-foreground">
                Interactive preview of dynamic forms generated from this JSON template
              </p>
            </div>
          </div>

          {/* Role Simulator Switcher & Close */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-lg">
              <UserCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">Simulate Role:</span>
              <select
                value={simulatedRole}
                onChange={(e) => setSimulatedRole(e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
              >
                <option value="admin">Administrator (Full Access)</option>
                <option value="buyer">Buyer</option>
                <option value="sqd">SQD (Quality Lead)</option>
                <option value="capacity_manager">Capacity Manager</option>
                <option value="viewer">Read-only Viewer</option>
              </select>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <DynamicForm
            template={template}
            initialValues={{}}
            onSave={(vals) => {
              alert(`Simulated Save Success!\nSubmitted Values:\n${JSON.stringify(vals, null, 2)}`);
            }}
            userRole={simulatedRole}
            title={`Preview Mode - ${template.name}`}
          />
        </div>
      </div>
    </div>
  );
};
