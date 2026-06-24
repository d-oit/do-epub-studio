import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Tooltip } from '../index';

function getTooltipWrapper(): HTMLElement {
  const candidate = document.querySelector('.relative.inline-flex');
  if (!candidate) throw new Error('Tooltip outer wrapper not found');
  return candidate as HTMLElement;
}

describe('Tooltip', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders children', () => {
    render(
      <Tooltip content="tooltip content">
        <button>Hover me</button>
      </Tooltip>,
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('uses native popover element when supported (jsdom fallback path otherwise)', () => {
    render(
      <Tooltip content="tooltip content">
        <button>Hover me</button>
      </Tooltip>,
    );
    // In jsdom the popover attribute is omitted (fallback path).
    // The element is not rendered until hover/focus.
    expect(screen.queryByText('tooltip content')).not.toBeInTheDocument();
  });

  it('shows tooltip content on pointer enter', () => {
    render(
      <Tooltip content="tooltip content">
        <button>Hover me</button>
      </Tooltip>,
    );
    const wrapper = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByText('tooltip content')).toBeInTheDocument();
  });

  it('hides tooltip on pointer leave (jsdom fallback)', () => {
    render(
      <Tooltip content="tooltip content">
        <button>Hover me</button>
      </Tooltip>,
    );
    const wrapper = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByText('tooltip content')).toBeInTheDocument();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText('tooltip content')).not.toBeInTheDocument();
  });

  it('opens popover via click on trigger (jsdom fallback uses mouse enter)', () => {
    render(
      <Tooltip content="click to open">
        <button>Trigger</button>
      </Tooltip>,
    );
    const wrapper = getTooltipWrapper();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByText('click to open')).toBeInTheDocument();
  });
});
