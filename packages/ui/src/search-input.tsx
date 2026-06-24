import { useState, useId } from 'react';

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

  if (debounceMs > 0 && local !== value) {
    const timer = setTimeout(() => { onChange(local); }, debounceMs);
    return null;
  }

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
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 pr-9 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {(value || local) && (
        <button
          type="button"
          onClick={() => {
            setLocal('');
            onClear ? onClear() : onChange('');
          }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ✕
        </button>
      )}
    </div>
  );
}
