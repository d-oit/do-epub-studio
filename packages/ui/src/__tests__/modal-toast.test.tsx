import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Modal } from '../modal';
import { ToastProvider, useToast, toast } from '../toast';

describe('Modal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={onClose}>
        Content
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        Content
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Title">
        Content
      </Modal>,
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <Modal isOpen={true} onClose={onClose} description="Test description">
        Content
      </Modal>,
    );
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(
      <Modal isOpen={true} onClose={onClose} footer={<button>Save</button>}>
        Content
      </Modal>,
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('calls onClose when clicking backdrop', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        Content
      </Modal>,
    );
    const backdrop = document.querySelector('.fixed.inset-0');
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking close button', () => {
    render(
      <Modal isOpen={true} onClose={onClose} title="Title">
        Content
      </Modal>,
    );
    const closeButton = screen.getByLabelText('Close');
    act(() => {
      closeButton.click();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when pressing Escape', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        Content
      </Modal>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('applies sm size class', () => {
    render(
      <Modal isOpen={true} onClose={onClose} size="sm">
        Content
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-sm');
  });

  it('applies lg size class', () => {
    render(
      <Modal isOpen={true} onClose={onClose} size="lg">
        Content
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-lg');
  });

  it('sets aria-labelledby when title provided', () => {
    render(
      <Modal isOpen={true} onClose={onClose} title="My Title">
        Content
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  it('sets aria-describedby when description provided', () => {
    render(
      <Modal isOpen={true} onClose={onClose} description="My Description">
        Content
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-describedby');
  });
});

describe('toast standalone function', () => {
  it('calls console.warn when not initialized', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    toast('success', 'Test');
    expect(warn).toHaveBeenCalledWith('Toast not initialized - wrap app in ToastProvider');
    warn.mockRestore();
  });
});

describe('ToastProvider and useToast', () => {
  function TestComponent() {
    const { toasts, addToast, removeToast } = useToast();
    return (
      <div>
        <button onClick={() => addToast('success', 'Success!')}>Add Success</button>
        <button onClick={() => addToast('error', 'Error!')}>Add Error</button>
        <button onClick={() => addToast('info', 'Info!')}>Add Info</button>
        <button onClick={() => addToast('warning', 'Warning!')}>Add Warning</button>
        <button onClick={() => addToast('success', 'No auto-dismiss', 0)}>Add No Auto</button>
        <span data-testid="count">{toasts.length}</span>
        {toasts.map((t) => (
          <div key={t.id} data-testid={`toast-${t.id}`}>
            {t.message}
            <button onClick={() => removeToast(t.id)}>Remove</button>
          </div>
        ))}
      </div>
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws when useToast used outside provider', () => {
    expect(() => render(<TestComponent />)).toThrow('useToast must be used within a ToastProvider');
  });

  it('adds toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add Success').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('adds different toast types', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add Error').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('removes toast manually', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add Success').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    act(() => {
      screen.getByText('Remove').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('auto-removes toast after duration', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add Success').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('does not auto-remove when duration is 0', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add No Auto').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('renders toast with success color', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add Success').click();
    });
    const alerts = screen.getAllByRole('alert');
    const lastAlert = alerts[alerts.length - 1];
    expect(lastAlert?.className).toContain('bg-semantic-success');
  });

  it('renders toast with error color', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add Error').click();
    });
    const alerts = screen.getAllByRole('alert');
    const lastAlert = alerts[alerts.length - 1];
    expect(lastAlert?.className).toContain('bg-semantic-error');
  });

  it('renders toast with info color', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add Info').click();
    });
    const alerts = screen.getAllByRole('alert');
    const lastAlert = alerts[alerts.length - 1];
    expect(lastAlert?.className).toContain('bg-semantic-info');
  });

  it('renders toast with warning color', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add Warning').click();
    });
    const alerts = screen.getAllByRole('alert');
    const lastAlert = alerts[alerts.length - 1];
    expect(lastAlert?.className).toContain('bg-semantic-warning');
  });

  it('has dismiss button with aria-label', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add Success').click();
    });
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });

  it('dismisses toast when clicking dismiss button', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Add Success').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    act(() => {
      screen.getByLabelText('Dismiss').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('returns null when no toasts', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
