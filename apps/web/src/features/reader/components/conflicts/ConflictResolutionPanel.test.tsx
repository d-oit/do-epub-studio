import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConflictResolutionPanel } from './ConflictResolutionPanel';
import { clearAllConflicts, detectConflict, ConflictType } from '../../../../lib/offline/conflict-resolution';
import { useReaderStore } from '../../../../stores/reader';
import { useAuthStore } from '../../../../stores';

vi.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (k: string, params?: Record<string, string | number>) => {
      if (params) {
        let result = k;
        for (const [key, value] of Object.entries(params)) {
          result = result.replaceAll(`{${key}}`, String(value));
        }
        return result;
      }
      return k;
    },
  }),
}));

vi.mock('../../../../stores', async () => {
  const actual = await vi.importActual('../../../../stores');
  return { ...actual };
});

const BOOK_ID = 'test-book-1';

function seedConflict(overrides?: {
  type?: ConflictType;
  localVersion?: unknown;
  remoteVersion?: unknown;
  localTimestamp?: number;
  remoteTimestamp?: number;
}): string {
  // Single timestamp: detectConflict() only creates a manual conflict when
  // localTimestamp === remoteTimestamp, so two separate Date.now() calls could
  // tick the millisecond between them and return null (flaky empty render).
  const now = Date.now();
  const conflict = detectConflict(
    overrides?.type ?? ConflictType.ProgressUpdate,
    overrides?.localVersion ?? { percent: 50 },
    overrides?.remoteVersion ?? { percent: 30 },
    overrides?.localTimestamp ?? now,
    overrides?.remoteTimestamp ?? now,
    BOOK_ID,
    'entity-1',
  );
  return conflict?.id ?? '';
}

beforeEach(() => {
  clearAllConflicts();
  useReaderStore.getState().clearConflicts();
  useAuthStore.setState({ bookId: BOOK_ID });
});

describe('ConflictResolutionPanel', () => {
  it('renders nothing when no conflicts', () => {
    const { container } = render(<ConflictResolutionPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders unresolved conflict', async () => {
    seedConflict();
    render(<ConflictResolutionPanel />);
    // Hydration (IndexedDB read) is now async (Plan 228 F2), so await the effect.
    expect(
      await screen.findByText('reader.conflicts.summary', { exact: true }),
    ).toBeInTheDocument();
  });

  it('keep-local resolves a conflict', async () => {
    const conflictId = seedConflict();
    render(<ConflictResolutionPanel />);
    const keepLocalBtn = await screen.findByRole('button', {
      name: /reader\.conflicts\.keepLocal/i,
    });
    fireEvent.click(keepLocalBtn);
    const updated = useReaderStore.getState().conflicts.find((c) => c.id === conflictId);
    expect(updated?.resolved).toBe(true);
    expect(updated?.resolution).toBe('local');
  });

  it('keep-remote resolves a conflict', async () => {
    const conflictId = seedConflict();
    render(<ConflictResolutionPanel />);
    const keepRemoteBtn = await screen.findByRole('button', {
      name: /reader\.conflicts\.keepRemote/i,
    });
    fireEvent.click(keepRemoteBtn);
    const updated = useReaderStore.getState().conflicts.find((c) => c.id === conflictId);
    expect(updated?.resolved).toBe(true);
    expect(updated?.resolution).toBe('remote');
  });

  it('dismiss clears a conflict', async () => {
    const conflictId = seedConflict();
    render(<ConflictResolutionPanel />);
    const dismissBtn = await screen.findByRole('button', { name: /reader\.conflicts\.dismiss/i });
    fireEvent.click(dismissBtn);
    const updated = useReaderStore.getState().conflicts.find((c) => c.id === conflictId);
    expect(updated?.resolved).toBe(true);
  });
});
