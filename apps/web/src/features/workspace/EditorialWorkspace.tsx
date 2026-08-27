/* eslint-disable i18next/no-literal-string -- Workspace layout labels */
import { useEffect, useState } from 'react';

export function EditorialWorkspace({
  toc,
  reader,
  annotations,
}: {
  toc?: React.ReactNode;
  reader?: React.ReactNode;
  annotations?: React.ReactNode;
}) {
  const [activeMobilePane, setActiveMobilePane] = useState<'toc' | 'annotations' | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        setActiveMobilePane((prev) => (prev === 'toc' ? null : 'toc'));
      } else if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        setActiveMobilePane((prev) => (prev === 'annotations' ? null : 'annotations'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="@container/workspace grid min-h-dvh grid-cols-1 bg-[var(--color-background)] @3xl/workspace:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_minmax(16rem,22rem)]">
      {/* Table of Contents - Desktop Column */}
      <nav aria-label="Table of contents" className="border-e border-[var(--color-rule)] @max-3xl/workspace:hidden">
        {toc}
      </nav>

      {/* Reader Surface */}
      <main id="main" className="min-w-0">
        {reader}
      </main>

      {/* Annotations - Desktop Column */}
      <aside aria-label="Annotations" className="border-s border-[var(--color-rule)] @max-3xl/workspace:hidden">
        {annotations}
      </aside>

      {/* Mobile Popover Triggers / Controls (visible when workspace is narrow) */}
      <div className="@3xl/workspace:hidden fixed bottom-4 right-4 z-40 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveMobilePane((p) => (p === 'toc' ? null : 'toc'))}
          className="rounded-[var(--radius-paper)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-xs font-medium text-[var(--color-foreground)] shadow-[var(--elevation-1)]"
        >
          Contents
        </button>
        <button
          type="button"
          onClick={() => setActiveMobilePane((p) => (p === 'annotations' ? null : 'annotations'))}
          className="rounded-[var(--radius-paper)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-xs font-medium text-[var(--color-foreground)] shadow-[var(--elevation-1)]"
        >
          Annotations
        </button>
      </div>

      {/* Mobile Popover Sheets */}
      {activeMobilePane === 'toc' && (
        <div
          role="dialog"
          aria-label="Table of contents mobile sheet"
          className="@3xl/workspace:hidden fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto bg-[var(--color-paper)] p-4 border-t border-[var(--color-rule)] shadow-[var(--elevation-2)]"
        >
          <div className="flex justify-between items-center pb-2 mb-4 border-b border-[var(--color-rule)]">
            <h2 className="font-semibold text-sm">Table of Contents</h2>
            <button
              type="button"
              onClick={() => setActiveMobilePane(null)}
              className="text-xs text-[var(--color-muted-foreground)] p-1"
            >
              Close
            </button>
          </div>
          {toc}
        </div>
      )}

      {activeMobilePane === 'annotations' && (
        <div
          role="dialog"
          aria-label="Annotations mobile sheet"
          className="@3xl/workspace:hidden fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto bg-[var(--color-paper)] p-4 border-t border-[var(--color-rule)] shadow-[var(--elevation-2)]"
        >
          <div className="flex justify-between items-center pb-2 mb-4 border-b border-[var(--color-rule)]">
            <h2 className="font-semibold text-sm">Annotations</h2>
            <button
              type="button"
              onClick={() => setActiveMobilePane(null)}
              className="text-xs text-[var(--color-muted-foreground)] p-1"
            >
              Close
            </button>
          </div>
          {annotations}
        </div>
      )}
    </div>
  );
}
