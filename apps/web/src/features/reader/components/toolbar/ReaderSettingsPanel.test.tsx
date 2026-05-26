import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReaderSettingsPanel } from './ReaderSettingsPanel';

describe('ReaderSettingsPanel', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    theme: 'light' as const,
    fontSize: 'medium' as const,
    fontFamily: 'serif' as const,
    onSetTheme: vi.fn(),
    onSetFontSize: vi.fn(),
    onSetFontFamily: vi.fn(),
    t: (key: string) => key,
  };

  it('handles Escape key', () => {
    render(<ReaderSettingsPanel {...mockProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('renders with correct aria-labels and aria-pressed states', () => {
    render(<ReaderSettingsPanel {...mockProps} />);

    const lightButton = screen.getByLabelText('reader.settings.theme.light');
    expect(lightButton).toHaveAttribute('aria-pressed', 'true');

    const darkButton = screen.getByLabelText('reader.settings.theme.dark');
    expect(darkButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSetTheme when a theme button is clicked', () => {
    render(<ReaderSettingsPanel {...mockProps} />);
    const darkButton = screen.getByLabelText('reader.settings.theme.dark');
    fireEvent.click(darkButton);
    expect(mockProps.onSetTheme).toHaveBeenCalledWith('dark');
  });

  it('shows font settings when not fixed-layout', () => {
    render(<ReaderSettingsPanel {...mockProps} isFixedLayout={false} />);
    expect(screen.getByLabelText('reader.settings.fontSize.medium')).toBeTruthy();
    expect(screen.getByText('reader.fontFamily')).toBeTruthy();
  });

  it('hides font size controls when fixed-layout', () => {
    render(<ReaderSettingsPanel {...mockProps} isFixedLayout={true} />);
    expect(screen.queryByText('reader.fontSize')).toBeNull();
    expect(screen.queryByText('reader.fontFamily')).toBeNull();
  });

  it('shows fixed layout indicator when isFixedLayout is true', () => {
    render(<ReaderSettingsPanel {...mockProps} isFixedLayout={true} />);
    expect(screen.getByText('reader.settings.fixedLayout')).toBeTruthy();
  });

  it('does not show fixed layout indicator when isFixedLayout is false', () => {
    render(<ReaderSettingsPanel {...mockProps} isFixedLayout={false} />);
    expect(screen.queryByText('reader.settings.fixedLayout')).toBeNull();
  });
});
