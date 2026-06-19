import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FixedLayoutControls } from './FixedLayoutControls';

vi.mock('@do-epub-studio/ui', () => ({
  useFocusTrap: () => {},
  scaleVariants: { initial: {}, animate: {}, exit: {} },
}));

function t(key: string): string {
  return key;
}

describe('FixedLayoutControls', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <FixedLayoutControls
        isOpen={false}
        onClose={vi.fn()}
        zoom={1.0}
        spread="auto"
        onSetZoom={vi.fn()}
        onSetSpread={vi.fn()}
        t={t}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title, zoom and spread controls when open', () => {
    render(
      <FixedLayoutControls
        isOpen
        onClose={vi.fn()}
        zoom={1.0}
        spread="auto"
        onSetZoom={vi.fn()}
        onSetSpread={vi.fn()}
        t={t}
      />,
    );
    expect(screen.getByText('reader.fixedLayout.title')).toBeInTheDocument();
    expect(screen.getByText('reader.fixedLayout.zoom')).toBeInTheDocument();
    expect(screen.getByText('reader.fixedLayout.spread')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('displays the current zoom as a percentage', () => {
    render(
      <FixedLayoutControls
        isOpen
        onClose={vi.fn()}
        zoom={1.5}
        spread="auto"
        onSetZoom={vi.fn()}
        onSetSpread={vi.fn()}
        t={t}
      />,
    );
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('calls onSetZoom with the next step when zoom in is clicked', async () => {
    const onSetZoom = vi.fn();
    render(
      <FixedLayoutControls
        isOpen
        onClose={vi.fn()}
        zoom={1.0}
        spread="auto"
        onSetZoom={onSetZoom}
        onSetSpread={vi.fn()}
        t={t}
      />,
    );
    await userEvent.click(screen.getByLabelText('reader.fixedLayout.zoomIn'));
    expect(onSetZoom).toHaveBeenCalledWith(1.25);
  });

  it('calls onSetZoom with the previous step when zoom out is clicked', async () => {
    const onSetZoom = vi.fn();
    render(
      <FixedLayoutControls
        isOpen
        onClose={vi.fn()}
        zoom={1.25}
        spread="auto"
        onSetZoom={onSetZoom}
        onSetSpread={vi.fn()}
        t={t}
      />,
    );
    await userEvent.click(screen.getByLabelText('reader.fixedLayout.zoomOut'));
    expect(onSetZoom).toHaveBeenCalledWith(1.0);
  });

  it('calls onSetZoom with 1.0 when reset is clicked', async () => {
    const onSetZoom = vi.fn();
    render(
      <FixedLayoutControls
        isOpen
        onClose={vi.fn()}
        zoom={1.5}
        spread="auto"
        onSetZoom={onSetZoom}
        onSetSpread={vi.fn()}
        t={t}
      />,
    );
    await userEvent.click(screen.getByLabelText('reader.fixedLayout.zoomReset'));
    expect(onSetZoom).toHaveBeenCalledWith(1.0);
  });

  it('disables zoom in at the maximum step', () => {
    render(
      <FixedLayoutControls
        isOpen
        onClose={vi.fn()}
        zoom={2.0}
        spread="auto"
        onSetZoom={vi.fn()}
        onSetSpread={vi.fn()}
        t={t}
      />,
    );
    const zoomIn = screen.getByLabelText('reader.fixedLayout.zoomIn');
    expect(zoomIn).toBeDisabled();
  });

  it('disables zoom out at the minimum step', () => {
    render(
      <FixedLayoutControls
        isOpen
        onClose={vi.fn()}
        zoom={0.5}
        spread="auto"
        onSetZoom={vi.fn()}
        onSetSpread={vi.fn()}
        t={t}
      />,
    );
    const zoomOut = screen.getByLabelText('reader.fixedLayout.zoomOut');
    expect(zoomOut).toBeDisabled();
  });

  it('calls onSetSpread when a spread option is selected', () => {
    const onSetSpread = vi.fn();
    render(
      <FixedLayoutControls
        isOpen
        onClose={vi.fn()}
        zoom={1.0}
        spread="auto"
        onSetZoom={vi.fn()}
        onSetSpread={onSetSpread}
        t={t}
      />,
    );
    fireEvent.click(screen.getByText('reader.fixedLayout.spread.both'));
    expect(onSetSpread).toHaveBeenCalledWith('both');
  });

  it('marks the active spread with aria-pressed=true', () => {
    render(
      <FixedLayoutControls
        isOpen
        onClose={vi.fn()}
        zoom={1.0}
        spread="none"
        onSetZoom={vi.fn()}
        onSetSpread={vi.fn()}
        t={t}
      />,
    );
    const noneBtn = screen.getByText('reader.fixedLayout.spread.none');
    expect(noneBtn.getAttribute('aria-pressed')).toBe('true');
    const autoBtn = screen.getByText('reader.fixedLayout.spread.auto');
    expect(autoBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <FixedLayoutControls
        isOpen
        onClose={onClose}
        zoom={1.0}
        spread="auto"
        onSetZoom={vi.fn()}
        onSetSpread={vi.fn()}
        t={t}
      />,
    );
    await userEvent.click(screen.getByLabelText('reader.settings.close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
