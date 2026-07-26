import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StorageQuota } from '../components/StorageQuota';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../components/ui', () => ({
  ConfirmDialog: ({
    isOpen,
    onCancel,
    onConfirm,
    title,
    confirmLabel,
    cancelLabel,
  }: Record<string, unknown>) =>
    isOpen ? (
      <div role="dialog">
        <h2>{title as string}</h2>
        <button
          type="button"
          onClick={onCancel as React.MouseEventHandler<HTMLButtonElement>}
        >
          {(cancelLabel as string) || 'cancel'}
        </button>
        <button
          type="button"
          onClick={onConfirm as React.MouseEventHandler<HTMLButtonElement>}
        >
          {(confirmLabel as string) || 'confirm'}
        </button>
      </div>
    ) : null,
}));

describe('StorageQuota', () => {
  let mockEstimate: ReturnType<typeof vi.fn>;
  let mockCacheKeys: ReturnType<typeof vi.fn>;
  let mockCacheDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock navigator.storage
    mockEstimate = vi.fn();
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: mockEstimate },
      writable: true,
      configurable: true,
    });

    // Mock caches API
    mockCacheKeys = vi.fn();
    mockCacheDelete = vi.fn();
    Object.defineProperty(window, 'caches', {
      value: { keys: mockCacheKeys, delete: mockCacheDelete },
      writable: true,
      configurable: true,
    });

    // Mock indexedDB.databases
    Object.defineProperty(window, 'indexedDB', {
      value: {
        ...window.indexedDB,
        databases: vi.fn().mockResolvedValue([]),
      },
      writable: true,
      configurable: true,
    });
  });

  it('shows loading skeleton initially', () => {
    mockEstimate.mockReturnValue(new Promise(() => {}));
    render(<StorageQuota />);
    // Loading state shows skeleton animation, no title text
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText((_, element) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Codacy false positive: element can be null in test matcher
      element?.className?.includes('animate-pulse') === true,
    )).toBeInTheDocument();
  });

  it('renders used and available bytes', async () => {
    mockEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue([]);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('storage.used'))).toBeInTheDocument();
    });
    expect(screen.getByText((content) => content.includes('storage.available'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('50.0 MB'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('100.0 MB'))).toBeInTheDocument();
  });

  it('renders progress bar with correct aria attributes', async () => {
    mockEstimate.mockResolvedValue({ usage: 500 * 1024 * 1024, quota: 1000 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue([]);

    render(<StorageQuota />);

    await waitFor(() => {
      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveAttribute('aria-valuenow', '50');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  it('shows warning when usage is >80%', async () => {
    mockEstimate.mockResolvedValue({ usage: 900 * 1024 * 1024, quota: 1000 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue([]);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByText('storage.highUsage')).toBeInTheDocument();
    });
  });

  it('does not show warning when usage is <=80%', async () => {
    mockEstimate.mockResolvedValue({ usage: 500 * 1024 * 1024, quota: 1000 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue([]);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
    expect(screen.queryByText('storage.highUsage')).not.toBeInTheDocument();
  });

  it('shows unsupported error when navigator.storage.estimate is unavailable', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: {},
      writable: true,
      configurable: true,
    });

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByText('storage.unsupported')).toBeInTheDocument();
    });
  });

  it('shows unsupported error when estimate throws', async () => {
    mockEstimate.mockRejectedValue(new Error('not available'));

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByText('storage.unsupported')).toBeInTheDocument();
    });
  });

  it('shows clear button disabled when usage is 0', async () => {
    mockEstimate.mockResolvedValue({ usage: 0, quota: 100 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue([]);

    render(<StorageQuota />);

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'storage.clearButton' });
      expect(btn).toBeDisabled();
    });
  });

  it('clear button opens confirm dialog when clicked', async () => {
    mockEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue([]);
    mockCacheDelete.mockResolvedValue(true);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'storage.clearButton' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'storage.clearButton' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('confirm dialog calls caches.delete for each cache key', async () => {
    mockEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue(['cache-1', 'cache-2']);
    mockCacheDelete.mockResolvedValue(true);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'storage.clearButton' })).not.toBeDisabled();
    });

    // Open confirm dialog
    fireEvent.click(screen.getByRole('button', { name: 'storage.clearButton' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click confirm button inside dialog (second button in the dialog)
    const dialog = screen.getByRole('dialog');
    const confirmBtn = dialog.querySelectorAll('button')[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockCacheKeys).toHaveBeenCalled();
      expect(mockCacheDelete).toHaveBeenCalledWith('cache-1');
      expect(mockCacheDelete).toHaveBeenCalledWith('cache-2');
    });
  });

  it('shows cleared message after clearing', async () => {
    mockEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue(['cache-1']);
    mockCacheDelete.mockResolvedValue(true);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'storage.clearButton' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'storage.clearButton' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const confirmBtn = dialog.querySelectorAll('button')[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('storage.cleared')).toBeInTheDocument();
    });
  });

  it('sets up auto-dismiss timer for cleared message', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    mockEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue(['cache-1']);
    mockCacheDelete.mockResolvedValue(true);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'storage.clearButton' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'storage.clearButton' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const confirmBtn = dialog.querySelectorAll('button')[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('storage.cleared')).toBeInTheDocument();
    });

    // Verify that a setTimeout was registered with the 3-second auto-dismiss delay
    const timeoutCall = setTimeoutSpy.mock.calls.find(
      ([, ms]) => ms === 3000,
    );
    expect(timeoutCall).toBeDefined();

    // Execute the auto-dismiss callback to verify it clears the message
    const dismissCallback = (timeoutCall as unknown as [() => void])[0];
    dismissCallback();

    // After executing the timeout callback, the cleared message should be gone
    await waitFor(() => {
      expect(screen.queryByText('storage.cleared')).not.toBeInTheDocument();
    });

    setTimeoutSpy.mockRestore();
  });

  it('shows clearing text on button while clearing', async () => {
    mockEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });
    const resolver: { resolve: () => void } = { resolve: () => {} };
    mockCacheKeys.mockImplementation(
      () => new Promise<string[]>((resolve) => { resolver.resolve = () => { resolve(['cache-1']); }; }),
    );
    mockCacheDelete.mockResolvedValue(true);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'storage.clearButton' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'storage.clearButton' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const confirmBtn = dialog.querySelectorAll('button')[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'storage.clearing' })).toBeInTheDocument();
    });

    resolver.resolve();
  });

  it('shows clear error when cache clear throws', async () => {
    mockEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });
    mockCacheKeys.mockRejectedValue(new Error('cache failure'));

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'storage.clearButton' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'storage.clearButton' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const confirmBtn = dialog.querySelectorAll('button')[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('storage.clearError')).toBeInTheDocument();
    });
  });

  it('calls indexedDB.databases and deletes non-auth databases', async () => {
    const mockDatabases = vi.fn().mockResolvedValue([
      { name: 'do-epub-books' },
      { name: 'do-epub-auth' },
      { name: 'do-epub-annotations' },
    ]);
    const mockDeleteDatabase = vi.fn().mockReturnValue({
      onsuccess: null,
      onerror: null,
    });
    Object.defineProperty(window, 'indexedDB', {
      value: {
        ...window.indexedDB,
        databases: mockDatabases,
        deleteDatabase: mockDeleteDatabase,
      },
      writable: true,
      configurable: true,
    });

    mockEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue([]);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'storage.clearButton' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'storage.clearButton' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const confirmBtn = dialog.querySelectorAll('button')[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDatabases).toHaveBeenCalled();
      expect(mockDeleteDatabase).toHaveBeenCalledWith('do-epub-books');
      expect(mockDeleteDatabase).toHaveBeenCalledWith('do-epub-annotations');
      expect(mockDeleteDatabase).not.toHaveBeenCalledWith('do-epub-auth');
    });
  });

  it('refreshes estimate after clearing', async () => {
    // 100 * 1024 * 1024 = 104857600 → formatBytes = "100.0 MB"
    // 200 * 1024 * 1024 = 209715200 → formatBytes = "200.0 MB"
    // 10 * 1024 * 1024 = 10485760 → formatBytes = "10.0 MB"
    mockEstimate.mockResolvedValue({ usage: 100 * 1024 * 1024, quota: 200 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue([]);
    mockCacheDelete.mockResolvedValue(true);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByText('100.0 MB')).toBeInTheDocument();
      expect(screen.getByText('200.0 MB')).toBeInTheDocument();
    });

    // Switch estimate to return lower usage after clearing
    mockEstimate.mockResolvedValue({ usage: 10 * 1024 * 1024, quota: 200 * 1024 * 1024 });

    fireEvent.click(screen.getByRole('button', { name: 'storage.clearButton' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const confirmBtn = dialog.querySelectorAll('button')[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('10.0 MB')).toBeInTheDocument();
    });
  });

  it('cancels confirm dialog when cancel is clicked', async () => {
    mockEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });
    mockCacheKeys.mockResolvedValue([]);

    render(<StorageQuota />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'storage.clearButton' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'storage.clearButton' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const cancelBtn = dialog.querySelectorAll('button')[0];
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mockCacheKeys).not.toHaveBeenCalled();
  });
});
