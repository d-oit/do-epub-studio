import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { VirtualList } from './VirtualList';

describe('VirtualList', () => {
  const items = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    label: `Item ${i}`,
  }));

  it('renders only visible items within the window', () => {
    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={40}
        renderItem={(item) => <span>{(item as { label: string }).label}</span>}
      />,
    );
    const rendered = container.querySelectorAll('li li');
    // Should render fewer items than total (overscan + visible)
    expect(rendered.length).toBeLessThan(items.length);
    expect(rendered.length).toBeGreaterThan(0);
  });

  it('accepts scrollToIndex prop without error', () => {
    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={40}
        scrollToIndex={50}
        renderItem={(item) => <span>{(item as { label: string }).label}</span>}
      />,
    );
    const list = container.querySelector('ul');
    expect(list).toBeInTheDocument();
  });

  it('ignores negative scrollToIndex', () => {
    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={40}
        scrollToIndex={-1}
        renderItem={(item) => <span>{(item as { label: string }).label}</span>}
      />,
    );
    const list = container.querySelector('ul');
    expect(list).toBeInTheDocument();
  });

  it('calls onVisibleRangeChange when rendered', () => {
    const onVisibleRangeChange = vi.fn();
    render(
      <VirtualList
        items={items}
        itemHeight={40}
        onVisibleRangeChange={onVisibleRangeChange}
        renderItem={(item) => <span>{(item as { label: string }).label}</span>}
      />,
    );
    expect(onVisibleRangeChange).toHaveBeenCalled();
  });

  it('renders with aria-label when provided', () => {
    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={40}
        ariaLabel="Test list"
        renderItem={(item) => <span>{(item as { label: string }).label}</span>}
      />,
    );
    const list = container.querySelector('ul[aria-label="Test list"]');
    expect(list).toBeInTheDocument();
  });
});
