import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { img: 'h-7 w-7', text: 'text-sm' },
  md: { img: 'h-9 w-9', text: 'text-base' },
  lg: { img: 'h-14 w-14', text: 'text-xl' },
};

export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
  const sizes = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img
        src="/capgemini-logo.svg"
        alt="Capgemini Logo"
        className={cn('shrink-0 rounded-lg object-contain shadow-soft', sizes.img)}
      />
      {showText && (
        <div className="min-w-0">
          <p className={cn('truncate font-semibold leading-tight', sizes.text)}>{APP_NAME}</p>
          <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
            CMF Platform
          </p>
        </div>
      )}
    </div>
  );
}

export function AuthLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      <img
        src="/capgemini-logo.svg"
        alt="Capgemini Logo"
        className="h-16 w-16 rounded-2xl object-contain shadow-soft-lg"
      />
      <div>
        <h2 className="text-lg font-bold tracking-tight">{APP_NAME}</h2>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">CMF Platform</p>
      </div>
    </div>
  );
}
