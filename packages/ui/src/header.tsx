import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { motion } from 'framer-motion';

type MotionHeaderProps = ComponentPropsWithoutRef<typeof motion.header>;

export interface HeaderProps extends Omit<MotionHeaderProps, 'onDrag' | 'onDragEnd' | 'onDragStart'> {
  sticky?: boolean;
  glass?: boolean;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(
  ({ sticky = true, glass = true, children, className = '', ...props }, ref) => {
    return (
      <motion.header
        ref={ref}
        initial={{ y: 'var(--motion-header-offset)', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className={`
          top-0 left-0 right-0 z-50 border-b border-border
          ${sticky ? 'fixed' : 'relative'}
          ${glass ? 'glass-panel' : 'bg-background'}
          ${className}
        `}
        {...props}
      >
        {children}
      </motion.header>
    );
  },
);

Header.displayName = 'Header';
