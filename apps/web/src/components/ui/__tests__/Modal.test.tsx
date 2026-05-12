import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../index';

// Override global framer-motion mock to properly handle ref via forwardRef
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) =>
      React.createElement('div', { ...props, ref }, children),
    ),
    svg: ({ children, ...props }: any) => React.createElement('svg', props, children),
    path: (props: any) => React.createElement('path', props),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

describe('Modal', () => {
  it('renders when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>content</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <p>content</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>content</p>
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>content</p>
      </Modal>,
    );
    const backdrop = container.querySelector('[class*="bg-black/50"]');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('focuses the modal when opened', () => {
    vi.useFakeTimers();
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    render(
      <Modal isOpen={true} onClose={() => {}} title="Focus">
        <p>content</p>
      </Modal>,
    );
    vi.advanceTimersByTime(0);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('tabIndex', '-1');
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
    vi.useRealTimers();
  });

  it('has proper aria attributes', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Aria Test">
        <p>content</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(document.getElementById(labelledBy!)).toBeInTheDocument();
  });

  it('restores focus to the trigger element when closed', async () => {
    vi.useFakeTimers();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <Modal isOpen={true} onClose={() => {}} title="Focus restoration">
        <p>content</p>
      </Modal>,
    );

    // Initial focus on modal
    vi.advanceTimersByTime(0);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);

    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
    vi.useRealTimers();
  });

  it('traps focus within the modal', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Focus Trap">
        <button data-testid="button1">Button 1</button>
        <button data-testid="button2">Button 2</button>
      </Modal>,
    );

    const closeButton = screen.getByLabelText('Close');
    const button1 = screen.getByTestId('button1');
    const button2 = screen.getByTestId('button2');

    // Start at last element
    button2.focus();
    expect(document.activeElement).toBe(button2);

    // Tab from last element should wrap to first (Close button)
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);

    // Shift+Tab from first element (Close button) should wrap to last
    closeButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(button2);
  });
});
