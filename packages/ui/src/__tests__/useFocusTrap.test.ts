import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';

function createContainerWithFocusables() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const btn1 = document.createElement('button');
  btn1.textContent = 'First';
  Object.defineProperty(btn1, 'offsetParent', { value: document.body, configurable: true });
  const btn2 = document.createElement('button');
  btn2.textContent = 'Second';
  Object.defineProperty(btn2, 'offsetParent', { value: document.body, configurable: true });
  const input = document.createElement('input');
  Object.defineProperty(input, 'offsetParent', { value: document.body, configurable: true });
  container.appendChild(btn1);
  container.appendChild(btn2);
  container.appendChild(input);
  return { container, btn1, btn2, input };
}

function createContainerWithTabbable() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const btn1 = document.createElement('button');
  btn1.tabIndex = 0;
  Object.defineProperty(btn1, 'offsetParent', { value: document.body, configurable: true });
  const btn2 = document.createElement('button');
  btn2.tabIndex = 0;
  Object.defineProperty(btn2, 'offsetParent', { value: document.body, configurable: true });
  container.appendChild(btn1);
  container.appendChild(btn2);
  return { container, btn1, btn2 };
}

function setActiveElement(el: Element | null) {
  Object.defineProperty(document, 'activeElement', {
    value: el,
    writable: true,
    configurable: true,
  });
}

describe('useFocusTrap', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('does nothing when inactive', () => {
    const { container } = createContainerWithFocusables();
    const containerRef = { current: container };
    const spy = vi.spyOn(container, 'querySelector');

    renderHook(() => { useFocusTrap(false, containerRef); });

    expect(spy).not.toHaveBeenCalled();
  });

  it('focuses first focusable element on activate', () => {
    const { container, btn1 } = createContainerWithFocusables();
    const containerRef = { current: container };

    renderHook(() => { useFocusTrap(true, containerRef); });

    expect(document.activeElement).toBe(btn1);
  });

  it('adds keydown listener when activated', () => {
    const { container } = createContainerWithTabbable();
    const containerRef = { current: container };
    const addSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => { useFocusTrap(true, containerRef); });

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    addSpy.mockRestore();
  });

  it('removes keydown listener on deactivate', () => {
    const { container } = createContainerWithTabbable();
    const containerRef = { current: container };
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => { useFocusTrap(true, containerRef); });
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('wraps focus to first element on Tab at last focusable', () => {
    const { container, btn1, btn2 } = createContainerWithTabbable();
    const containerRef = { current: container };

    renderHook(() => { useFocusTrap(true, containerRef); });

    setActiveElement(btn2);
    const focusSpy1 = vi.spyOn(btn1, 'focus');

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      document.dispatchEvent(event);
    });

    expect(focusSpy1).toHaveBeenCalled();
  });

  it('wraps focus to last element on Shift+Tab at first focusable', () => {
    const { container, btn1, btn2 } = createContainerWithTabbable();
    const containerRef = { current: container };

    renderHook(() => { useFocusTrap(true, containerRef); });

    setActiveElement(btn1);
    const focusSpy2 = vi.spyOn(btn2, 'focus');

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
      document.dispatchEvent(event);
    });

    expect(focusSpy2).toHaveBeenCalled();
  });

  it('does not wrap when pressing Tab on non-last element', () => {
    const { container, btn1, btn2 } = createContainerWithTabbable();
    const containerRef = { current: container };

    renderHook(() => { useFocusTrap(true, containerRef); });

    setActiveElement(btn1);
    const focusSpy1 = vi.spyOn(btn1, 'focus');
    const focusSpy2 = vi.spyOn(btn2, 'focus');

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      document.dispatchEvent(event);
    });

    expect(focusSpy1).not.toHaveBeenCalled();
    expect(focusSpy2).not.toHaveBeenCalled();
  });

  it('restores previous focus on deactivate', () => {
    const { container } = createContainerWithFocusables();
    const outsideBtn = document.createElement('button');
    document.body.appendChild(outsideBtn);

    setActiveElement(outsideBtn);

    const containerRef = { current: container };
    const focusSpy = vi.spyOn(outsideBtn, 'focus');

    const { unmount } = renderHook(() => { useFocusTrap(true, containerRef); });

    unmount();

    expect(focusSpy).toHaveBeenCalled();
  });

  it('does nothing when containerRef is null', () => {
    const containerRef = { current: null };

    const { unmount } = renderHook(() => { useFocusTrap(true, containerRef); });

    expect(() => { unmount(); }).not.toThrow();
  });

  it('does not handle Tab for non-Tab keys', () => {
    const { container, btn1, btn2 } = createContainerWithTabbable();
    const containerRef = { current: container };

    renderHook(() => { useFocusTrap(true, containerRef); });

    setActiveElement(btn1);
    const focusSpy2 = vi.spyOn(btn2, 'focus');

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      document.dispatchEvent(event);
    });

    expect(focusSpy2).not.toHaveBeenCalled();
  });
});
