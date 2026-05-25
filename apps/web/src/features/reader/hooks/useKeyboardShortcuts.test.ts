import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  const onPrevPage = vi.fn();
  const onNextPage = vi.fn();
  const onAddBookmark = vi.fn();
  const onHighlight = vi.fn();
  const onComment = vi.fn();
  const onToggleToc = vi.fn();
  const onToggleBookmarks = vi.fn();
  const onToggleComments = vi.fn();
  const onToggleSettings = vi.fn();
  const onShowHelp = vi.fn();

  const mockRendition = {
    on: vi.fn(),
    off: vi.fn(),
  };

  const defaultProps = {
    rendition: mockRendition as any,
    onPrevPage,
    onNextPage,
    onAddBookmark,
    onHighlight,
    onComment,
    onToggleToc,
    onToggleBookmarks,
    onToggleComments,
    onToggleSettings,
    onShowHelp,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('triggers navigation on arrow keys', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

    const preventDefaultLeft = vi.spyOn(leftEvent, 'preventDefault');
    const preventDefaultRight = vi.spyOn(rightEvent, 'preventDefault');

    window.dispatchEvent(leftEvent);
    expect(onPrevPage).toHaveBeenCalled();
    expect(preventDefaultLeft).toHaveBeenCalled();

    window.dispatchEvent(rightEvent);
    expect(onNextPage).toHaveBeenCalled();
    expect(preventDefaultRight).toHaveBeenCalled();
  });

  it('triggers bookmark on Ctrl+D', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);
    expect(onAddBookmark).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  it('triggers highlight on H', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    expect(onHighlight).toHaveBeenCalled();
  });

  it('triggers comment on C', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    expect(onComment).toHaveBeenCalled();
  });

  it('triggers panel toggles on Ctrl+Alt + Key', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    const tEvent = new KeyboardEvent('keydown', { key: 't', ctrlKey: true, altKey: true });
    window.dispatchEvent(tEvent);
    expect(onToggleToc).toHaveBeenCalled();

    const bEvent = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, altKey: true });
    window.dispatchEvent(bEvent);
    expect(onToggleBookmarks).toHaveBeenCalled();

    const mEvent = new KeyboardEvent('keydown', { key: 'm', ctrlKey: true, altKey: true });
    window.dispatchEvent(mEvent);
    expect(onToggleComments).toHaveBeenCalled();

    const sEvent = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, altKey: true });
    window.dispatchEvent(sEvent);
    expect(onToggleSettings).toHaveBeenCalled();
  });

  it('triggers help on ?', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    expect(onShowHelp).toHaveBeenCalled();
  });

  it('does not trigger if target is an input', () => {
    renderHook(() => useKeyboardShortcuts(defaultProps));

    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });

    window.dispatchEvent(event);
    expect(onPrevPage).not.toHaveBeenCalled();
  });

  it('registers/unregisters listeners on rendition', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts(defaultProps));

    expect(mockRendition.on).toHaveBeenCalledWith('keydown', expect.any(Function));

    unmount();
    expect(mockRendition.off).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
