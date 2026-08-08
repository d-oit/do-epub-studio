import { type ComponentPropsWithoutRef, forwardRef } from 'react';

export interface HeaderProps extends ComponentPropsWithoutRef<'header'> {
  sticky?: boolean;
  glass?: boolean;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(
  ({ sticky = true, glass = true, children, className = '', ...props }, ref) => {
    return (
      <header
        ref={ref}
        className={`
          top-0 left-0 right-0 z-50 border-b border-border
          animate-slide-down-fade
          ${sticky ? 'fixed' : 'relative'}
          ${glass ? 'glass-panel' : 'bg-background'}
          ${className}
        `}
        {...props}
      >
        {children}
      </header>
    );
  },
);

Header.displayName = 'Header';
