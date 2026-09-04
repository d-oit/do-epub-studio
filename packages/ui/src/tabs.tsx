/* biome-ignore-all lint/correctness/useQwikValidLexicalScope: this package uses React, not Qwik */
import { useState } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId?: string;
  defaultActiveId?: string;
  onChange?: (id: string) => void;
  className?: string;
  tabpanelClassName?: string;
  ariaLabel?: string;
}

export function Tabs({
  items,
  activeId,
  defaultActiveId,
  onChange,
  className = '',
  tabpanelClassName = '',
  ariaLabel,
}: TabsProps) {
  const firstId = items[0]?.id;
  const initialId = defaultActiveId ?? firstId ?? '';
  const [internalActive, setInternalActive] = useState(initialId);

  const active = activeId !== undefined ? activeId : internalActive;
  const activeItem = items.find((i) => i.id === active);

  const handleSelect = (id: string) => {
    if (activeId === undefined) {
      setInternalActive(id);
    }
    onChange?.(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = -1;
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = items.length - 1;
    }

    if (nextIndex !== -1) {
      e.preventDefault();
      const nextTab = items[nextIndex];
      if (nextTab) {
        handleSelect(nextTab.id);
        const container = e.currentTarget.parentElement;
        const buttons = container?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[nextIndex]?.focus();
      }
    }
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={ariaLabel} className="flex border-b border-border">
        {items.map((item, index) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`tabpanel-${item.id}`}
              id={`tab-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => { handleSelect(item.id); }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`flex-1 sm:flex-initial px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? 'border-b-2 border-accent text-accent font-semibold'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {activeItem && (
        <div
          role="tabpanel"
          id={`tabpanel-${activeItem.id}`}
          aria-labelledby={`tab-${activeItem.id}`}
          tabIndex={0}
          className={`pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg ${tabpanelClassName}`}
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
}
