/* biome-ignore-all lint/correctness/useQwikValidLexicalScope: this package uses React, not Qwik */
import { useState } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultActiveId?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({ items, defaultActiveId, onChange, className = '' }: TabsProps) {
  const firstId = items[0]?.id;
  const initialId = defaultActiveId ?? firstId ?? '';
  const [active, setActive] = useState(initialId);
  const activeItem = items.find((i) => i.id === active);

  const handleSelect = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  return (
    <div className={className}>
      <div role="tablist" className="flex border-b border-border">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`tabpanel-${item.id}`}
              id={`tab-${item.id}`}
              onClick={() => { handleSelect(item.id); }}
              className={`px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? 'border-b-2 border-accent text-foreground'
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
          className="pt-4"
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
}
