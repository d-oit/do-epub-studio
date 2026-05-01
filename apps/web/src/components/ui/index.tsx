/**
 * UI Primitives - 2026 Modern Design System
 * Glassmorphism, animations, and responsive utilities
 */

import { motion, AnimatePresence } from 'framer-motion';
import React, { useId, useState, isValidElement, cloneElement } from 'react';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

// ============================================
// Animation Variants
// ============================================

export const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const slideUpVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

export const slideDownVariants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, y: 20, transition: { duration: 0.2 } },
};

export const scaleVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

export const staggerContainerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ============================================
// Button Component
// ============================================

interface ButtonProps extends ComponentPropsWithoutRef<typeof motion.button> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
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
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 touch-target';

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
        whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
        transition={{ duration: 0.15 }}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
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

// ============================================
// Card Component
// ============================================

interface CardProps {
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={hover ? { y: -4, transition: { duration: 0.2 } } : undefined}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      >
        {children}
      </motion.div>
    );
  },
);

Card.displayName = 'Card';

// ============================================
// Input Component
// ============================================

type MotionInputBaseProps = Omit<
  ComponentPropsWithoutRef<typeof motion.input>,
  'onDrag' | 'onDragEnd' | 'onDragStart'
>;

interface InputProps extends MotionInputBaseProps {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1.5">
            {label}
          </label>
        )}
        <motion.input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          whileFocus={{ scale: 1.01 }}
          transition={{ duration: 0.1 }}
          className={`
            w-full px-4 py-3 bg-background border rounded-lg
            text-foreground placeholder:text-foreground-muted
            transition-all duration-150
            focus:border-accent focus:ring-2 focus:ring-accent/20
            outline-none
            ${error ? 'border-accent-error focus:border-accent-error focus:ring-accent-error/20' : 'border-border'}
            ${className}
          `}
          {...props}
        />
        {error ? (
          <p id={errorId} className="mt-1.5 text-sm text-accent-error">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="mt-1.5 text-sm text-foreground-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';

// ============================================
// Modal Component
// ============================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${sizeClasses[size]} z-50`}
          >
            <div className="glass-panel rounded-2xl p-6 m-4">
              {title && (
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-background-secondary transition-colors"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Skeleton Component
// ============================================

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton rounded ${className}`} />;
}

// ============================================
// Badge Component
// ============================================

interface BadgeProps extends Omit<
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

// ============================================
// Tooltip Component
// ============================================

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const id = useId();
  const [isVisible, setIsVisible] = useState(false);

  // Use cloneElement to inject aria-describedby for accessibility.
  // Visibility is handled via event capture on the wrapper div for robustness.
  const trigger = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': id,
      })
    : children;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocusCapture={() => setIsVisible(true)}
      onBlurCapture={() => setIsVisible(false)}
    >
      {trigger}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-foreground rounded shadow-lg pointer-events-none whitespace-nowrap z-50"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Page Container
// ============================================

type MotionDivProps = ComponentPropsWithoutRef<typeof motion.div>;

interface PageContainerProps extends Omit<MotionDivProps, 'animate' | 'children' | 'style'> {
  animate?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function PageContainer({
  animate = true,
  children,
  className = '',
  ...props
}: PageContainerProps) {
  if (animate) {
    return (
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={fadeVariants}
        className={`min-h-screen ${className}`}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  // Filter out motion-specific props for non-animate case
  const {
    initial: _initial,
    variants: _variants,
    exit: _exit,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    whileFocus: _whileFocus,
    whileDrag: _whileDrag,
    whileInView: _whileInView,
    onHoverStart: _onHoverStart,
    onHoverEnd: _onHoverEnd,
    onTapStart: _onTapStart,
    onTap: _onTap,
    onTapCancel: _onTapCancel,
    onDragStart: _onDragStart,
    onDrag: _onDrag,
    onDragEnd: _onDragEnd,
    layout: _layout,
    layoutId: _layoutId,
    ...divProps
  } = props as Record<string, unknown>;

  return (
    <div className={`min-h-screen ${className}`} {...divProps}>
      {children}
    </div>
  );
}

// ============================================
// Header Component
// ============================================

type MotionHeaderProps = ComponentPropsWithoutRef<typeof motion.header>;

interface HeaderProps extends Omit<MotionHeaderProps, 'onDrag' | 'onDragEnd' | 'onDragStart'> {
  sticky?: boolean;
  glass?: boolean;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(
  ({ sticky = true, glass = true, children, className = '', ...props }, ref) => {
    return (
      <motion.header
        ref={ref}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
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

// ============================================
// Icon Button
// ============================================

type MotionButtonProps = ComponentPropsWithoutRef<typeof motion.button>;

interface IconButtonProps extends Omit<MotionButtonProps, 'onDrag' | 'onDragEnd' | 'onDragStart'> {
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
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
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
