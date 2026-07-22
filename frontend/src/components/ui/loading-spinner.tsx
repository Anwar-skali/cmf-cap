import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

function LoadingSpinner({ size = 24, className, label }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2 className="animate-spin text-primary" style={{ width: size, height: size }} />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

export { LoadingSpinner };
