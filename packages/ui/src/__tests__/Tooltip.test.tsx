import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Tooltip } from '../tooltip';

function getTooltipWrapper(): HTMLElement {
  // The outer wrapper span (class="relative inline-flex") is the closest
  // ancestor of any rendered child (button or text) that has the mouseenter
  // listener attached.
  const candidate = document.querySelector('.relative.inline-flex');
  if (!candidate) throw new Error('Tooltip outer wrapper not found');
  return candidate as HTMLElement;
}

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders children', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('does not show tooltip initially (content not in DOM)', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText('Help text')).not.toBeInTheDocument();
  });

  it('uses native popover attribute when supported', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'popover',
    );
    Object.defineProperty(HTMLElement.prototype, 'popover', {
      configurable: true,
      get() {
        return this.getAttribute('popover') ?? '';
      },
      set(_v: string) {
        /* noop */
      },
    });
    (HTMLElement.prototype as unknown as { showPopover: () => void }).showPopover =
      function showPopover(this: HTMLElement) {
        this.setAttribute('data-popover-open', 'true');
      };
    try {
      render(
        <Tooltip content="Help text">
          <button type="button">Click me</button>
        </Tooltip>,
      );
      // In native mode the popover element is always in the DOM (so showPopover
      // can be called imperatively), so we query by attribute combination.
      const tooltip = document.querySelector('[role="tooltip"][popover]');
      expect(tooltip).not.toBeNull();
      expect(tooltip).toHaveAttribute('popover', 'auto');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'popover', originalDescriptor);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>)['popover'];
      }
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[
        'showPopover'
      ];
    }
  });

  it('shows tooltip on mouse enter (content added to DOM)', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    const wrapper = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Help text');
  });

  it('hides tooltip on mouse leave (content removed from DOM)', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    const wrapper = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus (content added to DOM)', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByText('Click me'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('hides tooltip on blur (content removed from DOM)', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByText('Click me'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(screen.getByText('Click me'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('sets aria-describedby when open', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    const wrapper = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper);
    const tooltip = screen.getByRole('tooltip');
    const innerSpan = screen.getByText('Click me').parentElement;
    expect(innerSpan).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('removes aria-describedby when hidden', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    const innerSpan = screen.getByText('Click me').parentElement;
    expect(innerSpan).not.toHaveAttribute('aria-describedby');
  });

  it('renders with string children', () => {
    render(<Tooltip content="Help">Plain text</Tooltip>);
    expect(screen.getByText('Plain text')).toBeInTheDocument();
  });

  it('shows tooltip with string children on hover', () => {
    render(<Tooltip content="Help">Plain text</Tooltip>);
    const wrapper = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help');
  });

  it('shows tooltip content on focus', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByText('Click me'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Help text');
  });

  it('toggles visibility on multiple hover cycles', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    const wrapper = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('respects side=bottom positioning class', () => {
    render(
      <Tooltip content="Help text" side="bottom">
        <button type="button">Click me</button>
      </Tooltip>,
    );
    const wrapper = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveAttribute('data-side', 'bottom');
    expect(tooltip.className).toMatch(/top-full/);
  });

  it('click on trigger is a no-op for tooltip open in jsdom (V9: hover/focus only)', () => {
    render(
      <Tooltip content="click open">
        <button>Click trigger</button>
      </Tooltip>,
    );
    const wrapper = getTooltipWrapper();
    const button = wrapper.querySelector('button');
    if (!button) throw new Error('trigger button missing');
    fireEvent.click(button);
    // In jsdom (fallback path) the click doesn't toggle state — only mouseEnter/focus do.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes popover on blur (focus management)', () => {
    render(
      <Tooltip content="blur me">
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText('Trigger');
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('exposes unique tooltip id used by aria-describedby', () => {
    const { unmount } = render(
      <Tooltip content="first">
        <button type="button">First</button>
      </Tooltip>,
    );
    const wrapper1 = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper1);
    const firstTooltip = screen.getByRole('tooltip');
    const firstId = firstTooltip.id;
    expect(firstId).toMatch(/^tooltip-/);
    unmount();

    render(
      <Tooltip content="second">
        <button type="button">Second</button>
      </Tooltip>,
    );
    const wrapper2 = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper2);
    const secondTooltip = screen.getByRole('tooltip');
    expect(secondTooltip.id).not.toBe(firstId);
  });
});

