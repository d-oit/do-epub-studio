import React from 'react';

export function ReaderSettings({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 bg-[var(--color-paper)] text-[var(--color-foreground)] rounded-[var(--radius-paper)] border border-[var(--color-rule)] shadow-[var(--elevation-1)]">
      {children}
    </div>
  );
}

ReaderSettings.Theme = function Theme({ children }: { children?: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
};

ReaderSettings.Type = function Type({ children }: { children?: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
};

ReaderSettings.Page = function Page({ children }: { children?: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
};
