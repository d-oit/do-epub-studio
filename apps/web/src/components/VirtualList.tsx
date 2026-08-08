import { useRef, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';

/**
 * VirtualList — windowed rendering for long lists in a scrollable container.
 * Only mounts items within ±OVERSCAN of the visible viewport.
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
  /** When set, scroll the container so this index is visible on mount or change. */
  scrollToIndex?: number;
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
  scrollToIndex,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLUListElement>(null);
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
      return () => {
        ro.disconnect();
      };
    }
    setContainerHeight(el.clientHeight);
  }, []);

  // Scroll to the requested index when it changes (e.g., active chapter).
  useEffect(() => {
    if (scrollToIndex == null || scrollToIndex < 0) return;
    const el = containerRef.current;
    if (!el) return;
    const targetTop = scrollToIndex * itemHeight;
    const viewHeight = el.clientHeight;
    // Only scroll if the target is outside the current visible window.
    if (targetTop < el.scrollTop || targetTop + itemHeight > el.scrollTop + viewHeight) {
      el.scrollTop = Math.max(0, targetTop - viewHeight / 2 + itemHeight / 2);
    }
  }, [scrollToIndex, itemHeight]);

  const onScroll = useCallback((e: React.UIEvent<HTMLUListElement>) => {
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
    <ul
      ref={containerRef}
      onScroll={onScroll}
      aria-label={ariaLabel}
      className={className}
      style={{ overflowY: 'auto', contain: 'strict', listStyle: 'none', margin: 0, padding: 0 }}
    >
      <li aria-hidden="true" style={{ height: totalHeight, position: 'relative' }}>
        <ul
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {visibleItems.map((item, i) => {
            const absoluteIndex = startIndex + i;
            // Stable key: item identity (if it has one) + absolute index as a
            // disambiguator for duplicate identities. Falls back to index when
            // the item is a primitive that may repeat (e.g., string labels).
            const itemKey =
              typeof item === 'string' || typeof item === 'number'
                ? `${item}-${absoluteIndex}`
                : ((item as { id?: string | number }).id ?? absoluteIndex);
            return (
              <li key={itemKey} style={{ height: itemHeight }}>
                {renderItem(item, absoluteIndex)}
              </li>
            );
          })}
        </ul>
      </li>
    </ul>
  );
}
