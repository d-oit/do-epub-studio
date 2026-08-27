import { forwardRef } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ elevated = false, children, className = '', ...props }, ref) => {
    const paperClasses = [
      'bg-[var(--color-paper)] text-[var(--color-ink)]',
      'rounded-[var(--radius-paper)] border border-[var(--color-rule)]',
      elevated ? 'shadow-[var(--elevation-2)]' : 'shadow-[var(--elevation-1)]',
    ].join(' ');

    return (
      <div
        ref={ref}
        className={`${paperClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';
