import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock logger
vi.mock('../../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

const ThrowError = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Prevent console.error from cluttering logs
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Normal Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Normal Content')).toBeInTheDocument();
  });

  it('renders fallback UI with retry button when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('calls reload when Reload Page is clicked', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalReload = window.location.reload;

    // Define property since it might be non-configurable
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: vi.fn() },
    });

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText('Reload Page'));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(window.location.reload).toHaveBeenCalled();

    // Restore
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: originalReload },
    });
  });
});
