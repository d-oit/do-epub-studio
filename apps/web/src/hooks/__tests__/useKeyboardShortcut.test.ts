import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useKeyboardShortcut } from '../useKeyboardShortcut';

function fireKey(key: string, mods: Record<string, boolean> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...mods });
  window.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcut', () => {
  it('calls handler on matching key', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcut('Escape', handler));
    fireKey('Escape');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call handler for different key', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcut('Escape', handler));
    fireKey('Enter');
    expect(handler).not.toHaveBeenCalled();
  });

  it('respects enabled=false', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcut('Escape', handler, { enabled: false }));
    fireKey('Escape');
    expect(handler).not.toHaveBeenCalled();
  });

  it('requires mod keys when specified', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcut('k', handler, { mods: ['ctrl'] }));
    fireKey('k');
    expect(handler).not.toHaveBeenCalled();
    fireKey('k', { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removes listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcut('Escape', handler));
    unmount();
    fireKey('Escape');
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows multiple independent registrations', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    renderHook(() => useKeyboardShortcut('Escape', h1));
    renderHook(() => useKeyboardShortcut('Escape', h2));
    fireKey('Escape');
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('attaches the listener to the provided target element (B16)', () => {
    const handler = vi.fn();
    const target = document.createElement('div');
    renderHook(() => useKeyboardShortcut('Escape', handler, { target }));

    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire on window when a target element is set (B16)', () => {
    const handler = vi.fn();
    const target = document.createElement('div');
    renderHook(() => useKeyboardShortcut('Escape', handler, { target }));

    fireKey('Escape');
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes the listener from the target element on unmount (B16)', () => {
    const handler = vi.fn();
    const target = document.createElement('div');
    const { unmount } = renderHook(() => useKeyboardShortcut('Escape', handler, { target }));

    unmount();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handler).not.toHaveBeenCalled();
  });
});
