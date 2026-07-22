import { useState, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  debounce?: number;
  loading?: boolean;
  onClear?: () => void;
}

function SearchInput({
  value: externalValue,
  onChange,
  debounce = 300,
  loading = false,
  onClear,
  className,
  placeholder = 'Search...',
  ...props
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(externalValue ?? '');
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (externalValue !== undefined && externalValue !== internalValue) {
      setInternalValue(externalValue);
    }
  }, [externalValue]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (onChange && externalValue === undefined) {
      const timer = setTimeout(() => {
        onChange(internalValue);
      }, debounce);
      return () => clearTimeout(timer);
    }
  }, [internalValue, debounce, onChange, externalValue]);

  const handleClear = () => {
    setInternalValue('');
    if (onChange) onChange('');
    if (onClear) onClear();
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Search className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <input
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent py-1 pl-10 pr-8 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      {internalValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export { SearchInput };
