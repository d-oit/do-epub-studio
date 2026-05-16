import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollDirection } from '../useScrollDirection';

describe('useScrollDirection', () => {
  beforeEach(() => {
    window.pageYOffset = 0;
    vi.clearAllMocks();
  });

  it('initially returns up', () => {
    const { result } = renderHook(() => useScrollDirection());
    expect(result.current).toBe('up');
  });

  it('returns down when scrolling down', () => {
    const { result } = renderHook(() => useScrollDirection());

    act(() => {
      window.pageYOffset = 100;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current).toBe('down');
  });

  it('returns up when scrolling back up', () => {
    const { result } = renderHook(() => useScrollDirection());

    // Scroll down first
    act(() => {
      window.pageYOffset = 100;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe('down');

    // Scroll up
    act(() => {
      window.pageYOffset = 50;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe('up');
  });

  it('ignores minor scroll changes (threshold)', () => {
    const { result } = renderHook(() => useScrollDirection());

    act(() => {
      window.pageYOffset = 5; // Less than 10px threshold
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current).toBe('up');
  });
});
