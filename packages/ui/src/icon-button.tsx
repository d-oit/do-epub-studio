import { type ComponentPropsWithoutRef, forwardRef } from 'react';

export interface IconButtonProps extends ComponentPropsWithoutRef<'button'> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'primary';
  label?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', variant = 'ghost', label, children, className = '', ...props }, ref) => {
    const computedLabel = label || props['aria-label'] || (typeof children === 'string' ? children : undefined);

    const baseClasses = [
      'inline-flex items-center justify-center gap-2',
      'size-11 p-0 text-sm font-medium tracking-tight',
      'rounded-[var(--radius-paper)] transition-[background-color,box-shadow,transform]',
      'duration-200 ease-[var(--ease-out-expo)]',
      'focus-visible:outline-none focus-visible:ring-2',
      'focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2',
      'focus-visible:ring-offset-[var(--color-paper)]',
      'disabled:pointer-events-none disabled:opacity-50',
      'motion-safe:active:scale-[0.98]',
      'touch-target',
    ].join(' ');

    const variantClasses = {
      default: 'bg-transparent text-[var(--color-foreground)] hover:bg-[color-mix(in_oklch,var(--color-paper)_90%,var(--color-foreground)_10%)]',
      ghost: 'bg-transparent text-[var(--color-foreground)] hover:bg-[color-mix(in_oklch,var(--color-paper)_90%,var(--color-foreground)_10%)]',
      primary: 'bg-[var(--color-foreground)] text-[var(--color-paper)] hover:opacity-90',
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-label={computedLabel}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {children}
        {computedLabel && <span className="sr-only">{computedLabel}</span>}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
