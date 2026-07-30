import React from 'react';

export type InputSourceType = 'source_package' | 'csv' | 'manual' | 'what_if';

export interface InputSourceOption {
  id: InputSourceType;
  title: string;
  description: string;
}

const DEFAULT_OPTIONS: InputSourceOption[] = [
  {
    id: 'source_package',
    title: 'Source Package',
    description: 'Create Object from Source System',
  },
  {
    id: 'csv',
    title: 'From CSV file',
    description: 'Upload an CSV file(.csv) with objects',
  },
  {
    id: 'manual',
    title: 'Manual Input',
    description: 'Enter the details manually',
  },
  {
    id: 'what_if',
    title: 'What-If Object',
    description: 'Create What-If Object from Standard object',
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
      <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option) => {
          const isSelected = selectedSource === option.id;

          return (
            <div
              key={option.id}
              onClick={() => onChange(option.id)}
              className={`group flex items-start gap-3.5 p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/25 ring-2 ring-blue-500/20 shadow-sm'
                  : 'border-slate-300 dark:border-slate-700 bg-card hover:border-blue-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
              }`}
            >
              {/* Radio Indicator */}
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-400 dark:border-slate-600 group-hover:border-blue-500 bg-background'
                }`}
              >
                {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>

              {/* Text & Description */}
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-foreground group-hover:text-blue-600 transition-colors">
                  {option.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {option.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
