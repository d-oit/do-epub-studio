import { useState, useId, useEffect } from 'react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  onClear?: () => void;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  ariaLabel = 'Search',
  onClear,
  debounceMs = 0,
}: SearchInputProps) {
  const id = useId();
  const [local, setLocal] = useState(value);

  useEffect(() => {
    if (debounceMs <= 0) return;
    const timer = setTimeout(() => {
      if (local !== value) onChange(local);
    }, debounceMs);
    return () => { clearTimeout(timer); };
  }, [local, debounceMs, onChange, value]);

  const handleClear = () => {
    setLocal('');
    if (onClear) onClear();
    else onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && (value || local)) {
      e.preventDefault();
      handleClear();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">{ariaLabel}</label>
      <input
        id={id}
        type="search"
        value={debounceMs > 0 ? local : value}
        onChange={(e) => {
          const v = e.target.value;
          if (debounceMs > 0) setLocal(v);
          else onChange(v);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 pe-9 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {(value || local) && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md min-w-[28px] min-h-[28px] p-1 text-foreground-muted hover:text-foreground hover:bg-background-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
