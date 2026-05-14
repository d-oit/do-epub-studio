import { type ComponentPropsWithoutRef, forwardRef } from 'react';

export interface BadgeProps extends Omit<
  ComponentPropsWithoutRef<'span'>,
  'onDrag' | 'onDragEnd' | 'onDragStart'
> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', children, className = '', ...props }, ref) => {
    const variantClasses = {
      default: 'bg-background-secondary text-foreground border-border',
      success: 'bg-accent-success/10 text-accent-success border-accent-success/20',
      warning: 'bg-accent-warning/10 text-accent-warning border-accent-warning/20',
      error: 'bg-accent-error/10 text-accent-error border-accent-error/20',
      info: 'bg-accent-info/10 text-accent-info border-accent-info/20',
    };

    return (
      <span
        ref={ref}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  },
);

Badge.displayName = 'Badge';
