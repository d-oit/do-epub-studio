import { type ComponentPropsWithoutRef, forwardRef } from 'react';

export interface IconButtonProps extends ComponentPropsWithoutRef<'button'> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'primary';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', variant = 'default', children, className = '', ...props }, ref) => {
    const sizeClasses = {
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-3',
    };

    const variantClasses = {
      default: 'text-foreground hover:bg-background-secondary',
      ghost: 'text-foreground/70 hover:text-foreground hover:bg-background-secondary',
      primary: 'text-accent hover:bg-accent/10',
    };

    return (
      <button
        ref={ref}
        className={`
          rounded-lg transition-all duration-150 hover:scale-110 active:scale-95
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
          touch-target
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
