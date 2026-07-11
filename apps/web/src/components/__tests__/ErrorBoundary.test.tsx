import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

import { logClientEvent } from '../../lib/client-logger';

vi.mock('../../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

vi.mock('@do-epub-studio/shared', () => ({
  createTraceId: () => 'test-trace-id',
  createSpanId: () => 'test-span-id',
}));

const ThrowError = ({ message = 'Test error' }: { message?: string }) => {
  throw new Error(message);
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Normal Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Normal Content')).toBeInTheDocument();
  });

  it('renders default fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom Fallback</div>}>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('renders custom translations', () => {
    render(
      <ErrorBoundary
        translations={{
          heading: 'Oops!',
          description: 'Something broke.',
          retry: 'Retry',
          home: 'Go Home',
        }}
      >
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Oops!')).toBeInTheDocument();
    expect(screen.getByText('Something broke.')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('shows retrying state when retry clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    const retryBtn = screen.getByText('Try Again');
    act(() => { fireEvent.click(retryBtn); });
    expect(screen.getByText('Retrying...')).toBeInTheDocument();
    expect(retryBtn).toBeDisabled();
  });

  it('logs error to client logger', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(logClientEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        event: 'ui.error-boundary',
      }),
    );
  });

  it('calls onCatch callback with error info', () => {
    const onCatch = vi.fn();
    render(
      <ErrorBoundary onCatch={onCatch}>
        <ThrowError message="Callback error" />
      </ErrorBoundary>,
    );
    expect(onCatch).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Callback error' }),
      expect.any(Object),
      'test-trace-id',
    );
  });

  it('renders trace id in error UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Trace ID')).toBeInTheDocument();
    expect(screen.getByText('test-trace-id')).toBeInTheDocument();
  });

  it('retry clears error state after 600ms delay', () => {
    const onError = vi.fn();
    const App = ({ shouldThrow }: { shouldThrow: boolean }) => (
      <ErrorBoundary onCatch={onError}>
        {shouldThrow ? <ThrowError /> : <div>Recovered Content</div>}
      </ErrorBoundary>
    );

    const { rerender } = render(<App shouldThrow={true} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    const retryBtn = screen.getByText('Try Again');
    act(() => { fireEvent.click(retryBtn); });
    expect(screen.getByText('Retrying...')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(600);
      rerender(<App shouldThrow={false} />);
    });

    expect(screen.getByText('Recovered Content')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('reload button renders and is clickable', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    const reloadBtn = screen.getByText('Reload Page');
    expect(reloadBtn).toBeInTheDocument();
    expect(reloadBtn.tagName).toBe('BUTTON');
  });

  it('does not render error UI when no error', () => {
    render(
      <ErrorBoundary>
        <div>Content</div>
      </ErrorBoundary>,
    );
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
