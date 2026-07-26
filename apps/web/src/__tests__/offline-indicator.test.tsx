import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OfflineIndicator } from '../components/OfflineIndicator';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'offline.banner': 'You are currently offline',
      };
      // eslint-disable-next-line security/detect-object-injection -- test translation lookup
      return Object.hasOwn(translations, key) ? translations[key] : key;
    },
  }),
}));

describe('OfflineIndicator', () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, writable: true, configurable: true });
  });

  it('renders nothing when online', () => {
    render(<OfflineIndicator />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the banner when offline on mount', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    render(<OfflineIndicator />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('You are currently offline')).toBeInTheDocument();
  });

  it('shows banner when going offline', () => {
    render(<OfflineIndicator />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      fireEvent(window, new Event('offline'));
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('You are currently offline')).toBeInTheDocument();
  });

  it('removes banner after going back online', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    render(<OfflineIndicator />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      fireEvent(window, new Event('online'));
    });

    // After the exit animation timeout (200ms), banner should be removed
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the warning icon', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    render(<OfflineIndicator />);
    const alert = screen.getByRole('alert');
    const icon = alert.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });

  it('has accessible aria-live attribute', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    render(<OfflineIndicator />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });
});
