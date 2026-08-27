import React from 'react';

export function ReaderToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label="Reader toolbar"
      className="flex items-center gap-1 rounded-[var(--radius-paper)] border border-[var(--color-rule)] bg-[var(--color-paper)] p-1 shadow-[var(--elevation-1)] text-[var(--color-foreground)]"
    >
      {children}
    </div>
  );
}

ReaderToolbar.Group = function Group({ children }: { children: React.ReactNode }) {
  return <div role="group" className="flex items-center gap-1">{children}</div>;
};

ReaderToolbar.Separator = function Separator() {
  return <div role="separator" className="mx-2 h-5 w-px bg-[var(--color-rule)]" />;
};
