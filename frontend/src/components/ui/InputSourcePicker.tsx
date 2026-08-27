import React from 'react';
import { ClipboardList, FileSpreadsheet } from 'lucide-react';

export type InputSourceType = 'manual' | 'excel';

export interface InputSourceOption {
  id: InputSourceType;
  title: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}

const DEFAULT_OPTIONS: InputSourceOption[] = [
  {
    id: 'manual',
    title: 'Manual Input',
    description: 'Enter all direct material object attributes manually using the structured form below.',
    icon: ClipboardList,
    badge: 'Standard',
  },
  {
    id: 'excel',
    title: 'Import from Excel',
    description: 'Upload an Excel (.xlsx) file. You will be redirected to the Document repository to manage the import.',
    icon: FileSpreadsheet,
    badge: 'Bulk Import',
  },
];

interface InputSourcePickerProps {
  selectedSource: InputSourceType;
  onChange: (source: InputSourceType) => void;
  title?: string;
  options?: InputSourceOption[];
}

export const InputSourcePicker: React.FC<InputSourcePickerProps> = ({
  selectedSource,
  onChange,
  title = 'Choose Input Source',
  options = DEFAULT_OPTIONS,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select how you want to create the direct material object.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option) => {
          const isSelected = selectedSource === option.id;
          const Icon = option.icon;

          return (
            <div
              key={option.id}
              onClick={() => onChange(option.id)}
              className={`group relative flex items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/25 shadow-md shadow-blue-500/10'
                  : 'border-slate-200 dark:border-slate-700 bg-card hover:border-blue-400/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
              }`}
            >
              {/* Icon Badge */}
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-muted/50 border-border text-muted-foreground group-hover:bg-blue-50 group-hover:border-blue-300 group-hover:text-blue-600 dark:group-hover:bg-blue-950/40'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>

              {/* Text */}
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-extrabold transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-foreground group-hover:text-blue-600'}`}>
                    {option.title}
                  </h3>
                  {option.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/30 text-blue-600 dark:text-blue-400'
                        : 'bg-muted/60 border-border text-muted-foreground'
                    }`}>
                      {option.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {option.description}
                </p>
              </div>

              {/* Radio dot */}
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400 bg-background'
                }`}
              >
                {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
