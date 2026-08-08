import { type ComponentPropsWithoutRef } from 'react';

export interface PageContainerProps extends ComponentPropsWithoutRef<'div'> {
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
  return (
    <div
      className={`min-h-dvh ${animate ? 'animate-fade-in' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
