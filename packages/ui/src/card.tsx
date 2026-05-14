import { forwardRef } from 'react';
import { motion } from 'framer-motion';

export interface CardProps {
  variant?: 'default' | 'glass' | 'elevated';
  hover?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', hover = true, children, className = '' }, ref) => {
    const baseClasses = 'rounded-xl overflow-hidden';

    const variantClasses = {
      default: 'bg-background-secondary border border-border',
      glass: 'glass-card',
      elevated: 'bg-background shadow-lg border border-border/50',
    };

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 'var(--motion-item-offset)' }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={hover ? { y: 'var(--motion-hover-lift)', transition: { duration: 0.2 } } : undefined}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      >
        {children}
      </motion.div>
    );
  },
);

Card.displayName = 'Card';
