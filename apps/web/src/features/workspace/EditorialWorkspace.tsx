/* eslint-disable i18next/no-literal-string -- Workspace layout labels */
import { useEffect, useState } from 'react';
import { IconButton } from '@do-epub-studio/ui';

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
      } else if (e.key === 'Escape' && activeMobilePane) {
        setActiveMobilePane(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMobilePane]);

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
          className="min-h-11 min-w-11 rounded-[var(--radius-paper)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground)] shadow-[var(--elevation-2)] touch-target active:scale-95 transition-transform"
        >
          Contents
        </button>
        <button
          type="button"
          onClick={() => setActiveMobilePane((p) => (p === 'annotations' ? null : 'annotations'))}
          className="min-h-11 min-w-11 rounded-[var(--radius-paper)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground)] shadow-[var(--elevation-2)] touch-target active:scale-95 transition-transform"
        >
          Annotations
        </button>
      </div>

      {/* Mobile Popover Overlay Backdrop */}
      {activeMobilePane && (
        <div
          className="@3xl/workspace:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
          onClick={() => setActiveMobilePane(null)}
        />
      )}

      {/* Mobile Popover Sheets */}
      {activeMobilePane === 'toc' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Table of contents mobile sheet"
          className="@3xl/workspace:hidden fixed inset-x-0 bottom-0 top-12 z-50 flex flex-col overflow-hidden rounded-t-[calc(var(--radius-paper)+0.25rem)] bg-[var(--color-paper)] border-t border-[var(--color-rule)] shadow-[var(--elevation-2)] animate-slide-in-bottom"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-rule)] p-4">
            <h2 className="text-base font-semibold text-[var(--color-foreground)]">Table of Contents</h2>
            <IconButton
              onClick={() => setActiveMobilePane(null)}
              label="Close"
              size="sm"
              variant="ghost"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </IconButton>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {toc}
          </div>
        </div>
      )}

      {activeMobilePane === 'annotations' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Annotations mobile sheet"
          className="@3xl/workspace:hidden fixed inset-x-0 bottom-0 top-12 z-50 flex flex-col overflow-hidden rounded-t-[calc(var(--radius-paper)+0.25rem)] bg-[var(--color-paper)] border-t border-[var(--color-rule)] shadow-[var(--elevation-2)] animate-slide-in-bottom"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-rule)] p-4">
            <h2 className="text-base font-semibold text-[var(--color-foreground)]">Annotations</h2>
            <IconButton
              onClick={() => setActiveMobilePane(null)}
              label="Close"
              size="sm"
              variant="ghost"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </IconButton>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {annotations}
          </div>
        </div>
      )}
    </div>
  );
}
