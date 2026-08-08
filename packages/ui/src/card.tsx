import { forwardRef } from 'react';

export interface CardProps {
  variant?: 'default' | 'glass' | 'elevated';
  hover?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', hover = true, children, className = '' }, ref) => {
    const baseClasses = 'rounded-xl overflow-hidden animate-slide-up-fade';

    const variantClasses = {
      default: 'bg-background-secondary border border-border',
      glass: 'glass-card',
      elevated: 'bg-background shadow-lg border border-border/50',
    };

    const hoverClass = hover ? 'hover:-translate-y-0.5 transition-transform duration-200' : '';

    return (
      <div
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${hoverClass} ${className}`}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';
