import type { ReactNode } from 'react';

interface LoadingFallbackProps {
  children?: ReactNode;
  label?: string;
  minHeight?: string;
}

export function PageLoadingFallback({
  label = 'Loading…',
  minHeight = 'min-h-[60vh]',
}: LoadingFallbackProps) {
  return (
    <div
      className={`flex ${minHeight} items-center justify-center bg-background p-8`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4" aria-hidden="true">
        <div
          className="w-10 h-10 rounded-xl bg-accent animate-pulse"
        />
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-accent/60 animate-pulse [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-accent/30 animate-pulse" />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
