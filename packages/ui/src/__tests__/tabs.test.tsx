import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from '../tabs';

describe('Tabs', () => {
  const items = [
    { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
    { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
  ];

  it('renders all tab labels', () => {
    render(<Tabs items={items} />);
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument();
  });

  it('shows first tab content by default', () => {
    render(<Tabs items={items} />);
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('switches content when a tab is clicked', () => {
    render(<Tabs items={items} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('marks selected tab with aria-selected', () => {
    render(<Tabs items={items} />);
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onChange when tab is clicked', () => {
    const onChange = vi.fn();
    render(<Tabs items={items} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
    expect(onChange).toHaveBeenCalledWith('tab2');
  });
});
