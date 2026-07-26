import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useThemeSync } from '../hooks/useThemeSync';
import { usePreferencesStore } from '../stores/preferences';

function createMockMediaQuery(matches = false) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  return {
    matches,
    media: '(prefers-color-scheme: dark)',
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
  usePreferencesStore.setState({
    reader: {
      theme: 'system',
      fontFamily: 'serif',
      fontSize: 'medium',
      lineHeight: 2,
      pageWidth: 'normal',
      direction: 'default',
      writingMode: 'horizontal-tb',
    },
  });
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark', 'sepia');
});

describe('useThemeSync', () => {
  it('sets data-theme attribute on document root for explicit theme', () => {
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    usePreferencesStore.getState().setTheme('dark');
    renderHook(() => { useThemeSync(); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('adds dark class for dark theme', () => {
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    usePreferencesStore.getState().setTheme('dark');
    renderHook(() => { useThemeSync(); });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('sepia')).toBe(false);
  });

  it('adds sepia class for sepia theme', () => {
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    usePreferencesStore.getState().setTheme('sepia');
    renderHook(() => { useThemeSync(); });

    expect(document.documentElement.classList.contains('sepia')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('removes dark and sepia classes for light theme', () => {
    document.documentElement.classList.add('dark', 'sepia');
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    usePreferencesStore.getState().setTheme('light');
    renderHook(() => { useThemeSync(); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('sepia')).toBe(false);
  });

  it('resolves system theme to dark when prefers-color-scheme is dark', () => {
    const mockMq = createMockMediaQuery(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    // theme stays 'system' (default from beforeEach)
    renderHook(() => { useThemeSync(); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('resolves system theme to light when prefers-color-scheme is light', () => {
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    renderHook(() => { useThemeSync(); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('listens for media query changes when theme is system', () => {
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    renderHook(() => { useThemeSync(); });

    expect(mockMq.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('does not listen for media query changes when theme is explicit', () => {
    const mockMq = createMockMediaQuery(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMq as unknown as MediaQueryList);

    usePreferencesStore.getState().setTheme('dark');
    renderHook(() => { useThemeSync(); });

    expect(mockMq.addEventListener).not.toHaveBeenCalled();
  });
});
