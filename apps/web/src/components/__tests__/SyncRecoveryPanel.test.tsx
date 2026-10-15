import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuthStore } from '../../stores/auth';
import { SyncRecoveryPanel } from '../SyncRecoveryPanel';

const { getSyncQueue, retrySyncItem } = vi.hoisted(() => ({
  getSyncQueue: vi.fn(),
  retrySyncItem: vi.fn(),
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../lib/offline/db', () => ({ getSyncQueue }));
vi.mock('../../lib/offline/sync', () => ({ retrySyncItem }));

const rejectedItem = {
  id: 'queue-id-1',
  type: 'annotation' as const,
  payload: { bookId: 'book-1', annotation: { comment: 'preserved text' } },
  mutationId: 'queue-id-1',
  createdAt: 1,
  attempts: 0,
  error: 'Invalid payload',
  permanentError: true,
};

describe('SyncRecoveryPanel', () => {
  beforeEach(() => {
    getSyncQueue.mockReset();
    retrySyncItem.mockReset();
    useAuthStore.setState({ sessionToken: 'session-token' });
  });

  it('inspects stored errors and payload, then retries by stable queue ID', async () => {
    getSyncQueue.mockResolvedValueOnce([rejectedItem]).mockResolvedValueOnce([]);
    render(<SyncRecoveryPanel pendingCount={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'offline.pendingSync' }));

    expect(await screen.findByText('Invalid payload')).toBeInTheDocument();
    fireEvent.click(screen.getByText('reader.details'));
    expect(screen.getByText(/preserved text/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => expect(retrySyncItem).toHaveBeenCalledWith('queue-id-1'));
    expect(await screen.findByText('annotation.syncPending')).toBeInTheDocument();
  });

  it('exports retained failed queue entries as JSON', async () => {
    getSyncQueue.mockResolvedValueOnce([rejectedItem]);
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:offline-errors');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<SyncRecoveryPanel pendingCount={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'offline.pendingSync' }));
    fireEvent.click(await screen.findByRole('button', { name: 'reader.exportNotes' }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const exportedBlob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(await exportedBlob.text()).toContain('Invalid payload');
    expect(click).toHaveBeenCalled();
    expect(document.querySelector('a[download="offline-sync-errors.json"]')).toBeNull();
  });
});
