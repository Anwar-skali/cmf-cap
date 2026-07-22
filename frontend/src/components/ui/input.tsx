import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  iconPrefix?: ReactNode;
  iconSuffix?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, iconPrefix, iconSuffix, ...props }, ref) => {
    return (
      <div className="relative">
        {iconPrefix && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            {iconPrefix}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-soft transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 hover:border-muted-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
            iconPrefix && 'pl-10',
            iconSuffix && 'pr-10',
            error && 'border-destructive focus-visible:ring-destructive/20 focus-visible:border-destructive',
            className,
          )}
          ref={ref}
          {...props}
        />
        {iconSuffix && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
            {iconSuffix}
          </div>
        )}
        {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
