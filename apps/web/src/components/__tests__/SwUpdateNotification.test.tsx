import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SwUpdateNotification } from '../SwUpdateNotification';
import { useSwUpdateStore } from '../../stores/sw-update';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'sw.updateAvailable': 'A new version is available.',
        'sw.updateAction': 'Update',
        'sw.dismissAction': 'Dismiss',
        'sw.offlineReady': 'App is ready for offline use.',
      };
      return translations[key] ?? key;
    },
    locale: 'en' as const,
    setLocale: vi.fn(),
  }),
}));

describe('SwUpdateNotification', () => {
  beforeEach(() => {
    useSwUpdateStore.setState({
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: null,
    });
  });

  it('renders nothing when no update is available', () => {
    const { container } = render(<SwUpdateNotification />);
    expect(container.innerHTML).toBe('');
  });

  it('renders update banner when needRefresh is true', () => {
    useSwUpdateStore.setState({
      needRefresh: true,
      updateServiceWorker: () => {},
    });

    render(<SwUpdateNotification />);
    expect(screen.getByText('A new version is available.')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('renders offline ready banner when offlineReady is true', () => {
    useSwUpdateStore.setState({
      offlineReady: true,
    });

    render(<SwUpdateNotification />);
    expect(screen.getByText('App is ready for offline use.')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('does not show Update button when offline ready', () => {
    useSwUpdateStore.setState({
      offlineReady: true,
    });

    render(<SwUpdateNotification />);
    expect(screen.getByText('App is ready for offline use.')).toBeInTheDocument();
    expect(screen.queryByText('Update')).not.toBeInTheDocument();
  });

  it('calls updateServiceWorker when Update is clicked', () => {
    const updateMock = vi.fn();
    useSwUpdateStore.setState({
      needRefresh: true,
      updateServiceWorker: updateMock,
    });

    render(<SwUpdateNotification />);
    fireEvent.click(screen.getByText('Update'));
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('triggers exit animation when Dismiss is clicked', () => {
    const dismissSpy = vi.fn();
    const originalDismiss = useSwUpdateStore.getState().dismiss;
    useSwUpdateStore.setState({
      needRefresh: true,
      updateServiceWorker: () => {},
      dismiss: dismissSpy,
    });

    const { container } = render(<SwUpdateNotification />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(container.querySelector('.animate-slide-out-bottom')).toBeInTheDocument();

    useSwUpdateStore.setState({ dismiss: originalDismiss });
  });
});
