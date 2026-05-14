import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { motion } from 'framer-motion';

type MotionButtonProps = ComponentPropsWithoutRef<typeof motion.button>;

export interface IconButtonProps extends Omit<MotionButtonProps, 'onDrag' | 'onDragEnd' | 'onDragStart'> {
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
      <motion.button
        ref={ref}
        whileTap={{ scale: 'var(--motion-scale-tap-lg)' }}
        whileHover={{ scale: 'var(--motion-scale-hover-lg)' }}
        className={`
          rounded-lg transition-colors duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
          touch-target
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${className}
        `}
        {...props}
      >
        {children}
      </motion.button>
    );
  },
);

IconButton.displayName = 'IconButton';
