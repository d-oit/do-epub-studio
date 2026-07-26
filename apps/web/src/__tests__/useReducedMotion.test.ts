import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '../hooks/useReducedMotion';

const MOCK_QUERY = '(prefers-reduced-motion: reduce)';

function createMockMediaQuery(matches = false) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  return {
    matches,
    media: MOCK_QUERY,
    onchange: null,
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    __trigger: (e: Partial<MediaQueryListEvent> = {}) => {
      for (const l of listeners) {
        l({ matches: e.matches ?? false } as MediaQueryListEvent);
      }
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.classList.remove('dark', 'sepia');
});

describe('useReducedMotion', () => {
  it('returns false when prefers-reduced-motion does not match', () => {
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion matches', () => {
    const mockMq = createMockMediaQuery(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when media query changes', () => {
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      mockMq.__trigger({ matches: true });
    });

    expect(result.current).toBe(true);
  });

  it('syncs with media query state on mount', () => {
    const mockMq = createMockMediaQuery(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    const { result } = renderHook(() => useReducedMotion());
    // Should sync from matchMedia, not from the initial useState(getMatch)
    expect(result.current).toBe(true);
  });

  it('subscribes to change events on mount', () => {
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    renderHook(() => useReducedMotion());
    expect(mockMq.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('unsubscribes from change events on unmount', () => {
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    const { unmount } = renderHook(() => useReducedMotion());
    unmount();

    expect(mockMq.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
