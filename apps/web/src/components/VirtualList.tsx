import { useRef, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';

/**
 * VirtualList — windowed rendering for long lists in fixed-height scroll
 * containers. Only renders items within ±OVERSCAN of the visible viewport.
 *
 * Use when:
 *   - Item count exceeds ~50 (TOC, annotation lists, search results)
 *   - Each item has uniform height (`itemHeight` prop)
 *   - Scrolling happens in a parent container (not the window)
 *
 * For variable-height items, pre-measure heights and pass as `itemHeight` map
 * (not implemented here — keep the assumption simple).
 */
export interface VirtualListProps<T> {
  items: readonly T[];
  itemHeight: number;
  overscan?: number;
  className?: string;
  ariaLabel?: string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Called when the visible range changes; useful for scroll-to-active logic. */
  onVisibleRangeChange?: (startIndex: number, endIndex: number) => void;
}

const DEFAULT_OVERSCAN = 5;

export function VirtualList<T>({
  items,
  itemHeight,
  overscan = DEFAULT_OVERSCAN,
  className,
  ariaLabel,
  renderItem,
  onVisibleRangeChange,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Measure container height once on mount + on resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // ResizeObserver is not available in jsdom; fall back to clientHeight.
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height);
        }
      });
      ro.observe(el);
      setContainerHeight(el.clientHeight);
      return () => ro.disconnect();
    }
    setContainerHeight(el.clientHeight);
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = containerHeight > 0 ? Math.ceil(containerHeight / itemHeight) : 0;
  const endIndex = Math.min(
    items.length,
    startIndex + visibleCount + overscan * 2,
  );

  useEffect(() => {
    if (onVisibleRangeChange) {
      onVisibleRangeChange(startIndex, endIndex);
    }
  }, [startIndex, endIndex, onVisibleRangeChange]);

  const visibleItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex],
  );

  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      role="list"
      aria-label={ariaLabel}
      className={className}
      style={{ overflowY: 'auto', contain: 'strict' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, i) => (
            <div
              key={startIndex + i}
              role="listitem"
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
