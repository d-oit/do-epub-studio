import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../components/ToastStack';

const ToastTrigger = ({ message = 'Test Toast', type = 'info' as any }) => {
  const { addToast } = useToast();
  return <button onClick={() => addToast(type, message)}>Show toast</button>;
};

describe('Toast', () => {
  it('renders toast via provider', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Saved!" type="success" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Show toast'));
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('renders success toast variant', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Done!" type="success" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Show toast'));
    const toast = screen.getByRole('status');
    expect(toast).toHaveClass('bg-green-50');
  });

  it('renders error toast variant with alert role', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Error!" type="error" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Show toast'));
    const toast = screen.getByRole('alert');
    expect(toast).toHaveClass('bg-red-50');
  });
});
