import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from '../tabs';

describe('Tabs', () => {
  const items = [
    { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
    { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
    { id: 'tab3', label: 'Tab 3', content: <div>Content 3</div> },
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

  it('marks selected tab with aria-selected and sets roving tabIndex', () => {
    render(<Tabs items={items} />);
    const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
    const tab2 = screen.getByRole('tab', { name: 'Tab 2' });

    expect(tab1).toHaveAttribute('aria-selected', 'true');
    expect(tab1).toHaveAttribute('tabindex', '0');
    expect(tab2).toHaveAttribute('aria-selected', 'false');
    expect(tab2).toHaveAttribute('tabindex', '-1');

    fireEvent.click(tab2);
    expect(tab2).toHaveAttribute('aria-selected', 'true');
    expect(tab2).toHaveAttribute('tabindex', '0');
    expect(tab1).toHaveAttribute('aria-selected', 'false');
    expect(tab1).toHaveAttribute('tabindex', '-1');
  });

  it('navigates tabs using ArrowRight, ArrowLeft, Home, and End keys', () => {
    render(<Tabs items={items} />);
    const tab1 = screen.getByRole('tab', { name: 'Tab 1' });

    // ArrowRight -> Tab 2
    fireEvent.keyDown(tab1, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('aria-selected', 'true');

    const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
    // ArrowRight -> Tab 3
    fireEvent.keyDown(tab2, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Tab 3' })).toHaveAttribute('aria-selected', 'true');

    const tab3 = screen.getByRole('tab', { name: 'Tab 3' });
    // ArrowRight wraps to Tab 1
    fireEvent.keyDown(tab3, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-selected', 'true');

    // ArrowLeft wraps to Tab 3
    fireEvent.keyDown(tab1, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Tab 3' })).toHaveAttribute('aria-selected', 'true');

    // Home -> Tab 1
    fireEvent.keyDown(tab3, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-selected', 'true');

    // End -> Tab 3
    fireEvent.keyDown(tab1, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Tab 3' })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders focusable tabpanel with aria-labelledby', () => {
    render(<Tabs items={items} />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-tab1');
  });

  it('calls onChange when tab is clicked', () => {
    const onChange = vi.fn();
    render(<Tabs items={items} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
    expect(onChange).toHaveBeenCalledWith('tab2');
  });
});
