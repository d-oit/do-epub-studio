import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../modal';

describe('Modal', () => {
  it('renders when isOpen is true', () => {
    render(<Modal isOpen={true} onClose={() => {}}><p>content</p></Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={() => {}}><p>content</p></Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose}><p>content</p></Modal>);
    const backdrop = document.querySelector('[class*="bg-black/50"]');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders title and children', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="My Modal">
        <p>modal body</p>
      </Modal>,
    );
    expect(screen.getByText('My Modal')).toBeInTheDocument();
    expect(screen.getByText('modal body')).toBeInTheDocument();
  });

  it('has proper aria attributes', () => {
    render(<Modal isOpen={true} onClose={() => {}} title="Aria"><p>content</p></Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });
});
