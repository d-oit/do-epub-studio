import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queueFeedbackSubmission, cancelPendingRetry, resetDrainPromise } from './sync';
import * as db from './db';
import { createFeedback } from '../api/feedback';
import { useAuthStore } from '../../stores/auth';
import {
  deleteFeedbackDraftByMutation,
  markFeedbackDraft,
} from './feedback-drafts';
import { clearAllPermissions } from './permissions';

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

vi.mock('./db', () => ({
  addToSyncQueue: vi.fn(),
  getSyncQueue: vi.fn(),
  removeSyncQueueItem: vi.fn(),
  updateSyncQueueItem: vi.fn(),
  getUnsyncedProgress: vi.fn(),
  getUnsyncedAnnotations: vi.fn(),
  saveProgress: vi.fn(),
  saveAnnotation: vi.fn(),
}));

vi.mock('../api/feedback', () => ({
  createFeedback: vi.fn(),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: { getState: vi.fn(() => ({ sessionToken: 'token-1' })) },
}));

vi.mock('./feedback-drafts', () => ({
  deleteFeedbackDraftByMutation: vi.fn(),
  markFeedbackDraft: vi.fn(),
}));

vi.mock('./permissions', () => ({
  clearAllPermissions: vi.fn(),
}));

vi.mock('../client-logger', () => ({
  logClientEvent: vi.fn(),
}));

vi.mock('@do-epub-studio/shared', () => ({
  createTraceId: () => 'trace-id',
  createSpanId: () => 'span-id',
}));

const FEEDBACK_PAYLOAD = {
  bookId: 'book-1',
  draftId: 'draft-1',
  kind: 'suggestion' as const,
  category: 'grammar' as const,
  body: 'Consider a comma.',
  proposedText: 'Consider, a comma.',
  anchor: { selectedText: 'Consider a comma.' },
  mutationId: 'm-fb-1',
};

function queueItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-fb-1',
    type: 'feedback' as const,
    payload: { ...FEEDBACK_PAYLOAD },
    mutationId: 'm-fb-1',
    createdAt: 100,
    attempts: 0,
    ...overrides,
  };
}

describe('feedback sync replay (REL-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    vi.mocked(useAuthStore.getState).mockReturnValue({ sessionToken: 'token-1' } as never);
    cancelPendingRetry();
    resetDrainPromise();
  });

  it('submits once on success and deletes the local draft', async () => {
    vi.mocked(db.getSyncQueue).mockResolvedValue([queueItem()]);
    vi.mocked(createFeedback).mockResolvedValue({ id: 'fb-1' } as never);

    await queueFeedbackSubmission({ ...FEEDBACK_PAYLOAD });

    await vi.waitFor(() => {
      expect(createFeedback).toHaveBeenCalledTimes(1);
    });
    expect(createFeedback).toHaveBeenCalledWith(
      'book-1',
      expect.objectContaining({ mutationId: 'm-fb-1', body: 'Consider a comma.' }),
      'token-1',
    );
    await vi.waitFor(() => {
      expect(db.removeSyncQueueItem).toHaveBeenCalledWith('item-fb-1');
    });
  });

  it('marks the draft blocked (not revoked) on 403 lost-rights', async () => {
    vi.mocked(db.getSyncQueue).mockResolvedValue([queueItem()]);
    vi.mocked(createFeedback).mockRejectedValue(
      Object.assign(new Error('Access denied'), { status: 403 }),
    );

    await queueFeedbackSubmission({ ...FEEDBACK_PAYLOAD });

    await vi.waitFor(() => {
      expect(markFeedbackDraft).toHaveBeenCalledWith('draft-1', 'blocked', expect.anything());
    });
    // A lost contribution grant is not a dead session: permissions stay,
    // and no revoked callback fires (the reader can keep reading).
    expect(clearAllPermissions).not.toHaveBeenCalled();
    expect(db.removeSyncQueueItem).toHaveBeenCalledWith('item-fb-1');
    expect(deleteFeedbackDraftByMutation).not.toHaveBeenCalled();
  });

  it('marks the draft blocked on 422 invalid payload', async () => {
    vi.mocked(db.getSyncQueue).mockResolvedValue([queueItem()]);
    vi.mocked(createFeedback).mockRejectedValue(
      Object.assign(new Error('Invalid payload'), { status: 422 }),
    );

    await queueFeedbackSubmission({ ...FEEDBACK_PAYLOAD });

    await vi.waitFor(() => {
      expect(markFeedbackDraft).toHaveBeenCalledWith('draft-1', 'blocked', expect.anything());
    });
    expect(clearAllPermissions).not.toHaveBeenCalled();
  });

  it('retains the queue item on network failure for retry', async () => {
    vi.mocked(db.getSyncQueue).mockResolvedValue([queueItem()]);
    vi.mocked(createFeedback).mockRejectedValue(new TypeError('Failed to fetch'));

    await queueFeedbackSubmission({ ...FEEDBACK_PAYLOAD });

    await vi.waitFor(() => {
      expect(db.updateSyncQueueItem).toHaveBeenCalled();
    });
    expect(db.removeSyncQueueItem).not.toHaveBeenCalled();
    expect(markFeedbackDraft).not.toHaveBeenCalled();
    expect(deleteFeedbackDraftByMutation).not.toHaveBeenCalled();
  });

  it('still routes dead sessions (401) through permission_revoked', async () => {
    vi.mocked(db.getSyncQueue).mockResolvedValue([queueItem()]);
    vi.mocked(createFeedback).mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    );

    await queueFeedbackSubmission({ ...FEEDBACK_PAYLOAD });

    await vi.waitFor(() => {
      expect(clearAllPermissions).toHaveBeenCalled();
    });
    expect(markFeedbackDraft).not.toHaveBeenCalled();
  });
});
