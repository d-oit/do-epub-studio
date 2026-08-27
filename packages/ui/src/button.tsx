import { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingLabel?: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading,
      loadingLabel,
      children,
      className = '',
      disabled,
      type = 'button',
      onClick,
      ...props
    },
    ref,
  ) => {
    const baseClasses = [
      'inline-flex items-center justify-center gap-2',
      'min-h-11 px-4 text-sm font-medium tracking-tight',
      'rounded-[var(--radius-paper)] transition-[background-color,box-shadow,transform]',
      'duration-200 ease-[var(--ease-out-expo)]',
      'focus-visible:outline-none focus-visible:ring-2',
      'focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2',
      'focus-visible:ring-offset-[var(--color-paper)]',
      'disabled:pointer-events-none disabled:opacity-50',
      'motion-safe:active:scale-[0.98]',
    ].join(' ');

    const variantClasses = {
      primary: 'bg-[var(--color-foreground)] text-[var(--color-paper)] hover:opacity-90',
      secondary:
        'bg-transparent text-[var(--color-foreground)] border border-[var(--color-rule)] hover:bg-[color-mix(in_oklch,var(--color-paper)_88%,var(--color-foreground)_12%)]',
      ghost:
        'bg-transparent hover:bg-[color-mix(in_oklch,var(--color-paper)_90%,var(--color-foreground)_10%)] text-[var(--color-foreground)]',
      danger: 'bg-[var(--color-accent-error)] text-[var(--color-paper)] hover:opacity-90',
    };

    const sizeClasses = {
      sm: 'min-h-9 px-3 text-xs',
      md: 'min-h-11 px-4 text-sm',
      lg: 'min-h-12 px-6 text-base',
    };

    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ms-1 me-2 h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {loadingLabel || 'Loading...'}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
