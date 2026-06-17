import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollDirection } from '../useScrollDirection';

describe('useScrollDirection', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollY', 0);

    // Explicitly mock on window for jsdom
    window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      return Number(setTimeout(() => cb(Date.now()), 0));
    });

    window.cancelAnimationFrame = vi.fn((id: number) => {
      clearTimeout(id);
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const scroll = (y: number) => {
    act(() => {
      // Mocking scrollY by stubbing the global property
      vi.stubGlobal('scrollY', y);
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => {
      vi.runAllTimers();
    });
  };

  it('initially returns up', () => {
    const { result } = renderHook(() => useScrollDirection());
    expect(result.current).toBe('up');
  });

  it('returns down when scrolling down past threshold', () => {
    const { result } = renderHook(() => useScrollDirection());

    scroll(50); // > 10 threshold

    expect(result.current).toBe('down');
  });

  it('does not change direction if movement is below threshold', () => {
    const { result } = renderHook(() => useScrollDirection());

    scroll(5); // < 10 threshold

    expect(result.current).toBe('up');
  });

  it('returns up when scrolling back up past threshold', () => {
    const { result } = renderHook(() => useScrollDirection());

    scroll(50);
    expect(result.current).toBe('down');

    scroll(20); // scrolled up 30, > 10 threshold
    expect(result.current).toBe('up');
  });
});
