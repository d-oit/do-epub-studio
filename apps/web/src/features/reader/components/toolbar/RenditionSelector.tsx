import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { RenditionItem } from '@do-epub-studio/reader-core';
import type { TranslationKeys } from '../../../../i18n';

export interface RenditionSelectorProps {
  renditions: RenditionItem[];
  activeRendition: RenditionItem | null;
  onSelectRendition: (fullPath: string) => void;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
}

export function RenditionSelector({
  renditions,
  activeRendition,
  onSelectRendition,
  t,
}: RenditionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation within menu
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const buttons = Array.from(
        containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
      );
      if (buttons.length === 0) return;
      const currentIdx = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const nextIdx =
        e.key === 'ArrowDown'
          ? (currentIdx + 1) % buttons.length
          : (currentIdx - 1 + buttons.length) % buttons.length;
      buttons[nextIdx]?.focus();
    }
  };

  if (!renditions || renditions.length <= 1) {
    return null;
  }

  const currentLabel =
    activeRendition?.label ?? renditions[0]?.label ?? t('reader.renditions.title');

  return (
    <div ref={containerRef} className="relative inline-block text-left" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={t('reader.renditions.select')}
        className="min-h-11 px-3 py-1.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface text-foreground text-xs sm:text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer transition-colors"
      >
        <svg
          className="w-4 h-4 text-foreground-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <span className="truncate max-w-36 sm:max-w-48">{currentLabel}</span>
        <svg
          className={`w-3.5 h-3.5 text-foreground-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t('reader.renditions.title')}
          className="absolute right-0 mt-1.5 w-56 rounded-md bg-surface border border-border shadow-md py-1 z-50 focus:outline-none"
        >
          <div className="px-3 py-1 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
            {t('reader.renditions.title')}
          </div>
          {renditions.map((item) => {
            const isSelected =
              activeRendition?.fullPath === item.fullPath || (!activeRendition && item.isDefault);
            return (
              <button
                key={item.fullPath}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  onSelectRendition(item.fullPath);
                  setIsOpen(false);
                }}
                className={`w-full min-h-11 text-left px-3 py-2 text-xs sm:text-sm flex items-center justify-between gap-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none cursor-pointer transition-colors ${
                  isSelected ? 'font-semibold text-foreground' : 'text-foreground-muted'
                }`}
              >
                <span className="truncate">{item.label}</span>
                {isSelected && (
                  <svg
                    className="w-4 h-4 text-accent shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
