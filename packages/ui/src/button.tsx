import { forwardRef } from 'react';
import { motion } from 'framer-motion';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading,
      children,
      className = '',
      disabled,
      type = 'button',
      onClick,
    },
    ref,
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

    const variantClasses = {
      primary:
        'bg-accent text-white hover:bg-accent/90 active:scale-[0.98] focus-visible:ring-accent disabled:bg-accent/50',
      secondary:
        'bg-background-secondary text-foreground border border-border hover:bg-background-tertiary active:scale-[0.98] focus-visible:ring-accent',
      ghost:
        'text-foreground/70 hover:text-foreground hover:bg-background-secondary active:scale-[0.98] focus-visible:ring-accent',
      danger:
        'bg-accent-error text-white hover:bg-accent-error/90 active:scale-[0.98] focus-visible:ring-accent-error disabled:bg-accent-error/50',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        onClick={onClick}
        whileTap={{ scale: disabled || isLoading ? 1 : 'var(--motion-scale-tap)' }}
        whileHover={{ scale: disabled || isLoading ? 1 : 'var(--motion-scale-hover)' }}
        transition={{ duration: 0.15 }}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
            Loading...
          </>
        ) : (
          children
        )}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
