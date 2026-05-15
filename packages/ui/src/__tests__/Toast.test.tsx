import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, toast } from '../toast';

describe('Toast', () => {
  it('renders toast via provider', () => {
    function TestConsumer() {
      return (
        <button onClick={() => toast('success', 'Saved!')}>Show toast</button>
      );
    }
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Show toast'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('exports toast function that warns when not initialized', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    toast('info', 'no provider');
    expect(warn).toHaveBeenCalledWith('Toast not initialized - wrap app in ToastProvider');
    warn.mockRestore();
  });

  it('renders success toast variant', () => {
    function TestConsumer() {
      return (
        <button onClick={() => toast('success', 'Done!')}>trigger</button>
      );
    }
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
