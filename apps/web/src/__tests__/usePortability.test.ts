import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockAuthState = { sessionToken: 'tok-123' as string | null };

const mockReaderState = {
  progress: { locator: null, progressPercent: 0, updatedAt: null, revision: 0 },
  highlights: [],
  comments: [],
  bookmarks: [],
};

const mockPreferencesState = {
  reader: {
    theme: 'system',
    fontFamily: 'serif',
    fontSize: 'medium',
    lineHeight: 2,
    pageWidth: 'normal',
    direction: 'default',
    writingMode: 'horizontal-tb',
    aiEnabled: false,
  },
};

vi.mock('../stores', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector?: (state: typeof mockAuthState) => unknown) =>
      selector ? selector(mockAuthState) : mockAuthState,
    ),
    {
      getState: () => mockAuthState,
      setState: vi.fn(),
    },
  ),
  useReaderStore: Object.assign(
    vi.fn((selector?: (state: typeof mockReaderState) => unknown) =>
      selector ? selector(mockReaderState) : mockReaderState,
    ),
    {
      getState: () => mockReaderState,
      setState: vi.fn(),
    },
  ),
}));

vi.mock('../stores/preferences', () => ({
  usePreferencesStore: Object.assign(
    vi.fn((selector?: (state: typeof mockPreferencesState) => unknown) =>
      selector ? selector(mockPreferencesState) : mockPreferencesState,
    ),
    {
      getState: () => mockPreferencesState,
      setState: vi.fn(),
    },
  ),
}));

vi.mock('./useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

import { usePortability } from '../hooks/usePortability';

describe('usePortability', () => {
  it('defaults includeBookFiles to false for book scope (opt-in is account-only)', () => {
    const { result } = renderHook(() => usePortability());
    act(() => {
      result.current.open('book', { id: 'b1', title: 'T', slug: 's' });
    });
    expect(result.current.state.scope).toBe('book');
    expect(result.current.state.includeBookFiles).toBe(false);
  });

  it('defaults includeBookFiles to false for account scope too', () => {
    const { result } = renderHook(() => usePortability());
    act(() => {
      result.current.open('account');
    });
    expect(result.current.state.scope).toBe('account');
    expect(result.current.state.includeBookFiles).toBe(false);
  });
});
