import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InstallPwaSection } from '../InstallPwaSection';
import { usePwaInstallStore } from '../../stores/pwa-install';

const promptInstall = vi.fn<() => Promise<'accepted' | 'dismissed' | 'unavailable'>>();

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params?.app ? `${key}:${params.app}` : key,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

vi.mock('../../lib/pwa-install', () => ({
  promptInstall: () => promptInstall(),
}));

describe('InstallPwaSection', () => {
  beforeEach(() => {
    promptInstall.mockReset();
    promptInstall.mockResolvedValue('accepted');
    usePwaInstallStore.setState({ canPrompt: false, installed: false, dismissed: false });
  });

  it('renders nothing when the browser offers no install prompt', () => {
    const { container } = render(<InstallPwaSection />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the install call to action when a prompt is available', () => {
    usePwaInstallStore.setState({ canPrompt: true });
    render(<InstallPwaSection />);

    expect(screen.getByText('settings.install.title')).toBeInTheDocument();
    expect(screen.getByText(/^settings\.install\.description:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.install.action' })).toBeInTheDocument();
  });

  it('renders nothing when the app is already installed', () => {
    usePwaInstallStore.setState({ canPrompt: true, installed: true });
    const { container } = render(<InstallPwaSection />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing after the user dismissed the prompt this session', () => {
    usePwaInstallStore.setState({ canPrompt: true, dismissed: true });
    const { container } = render(<InstallPwaSection />);
    expect(container.innerHTML).toBe('');
  });

  it('hides the row when the native prompt is dismissed', async () => {
    promptInstall.mockResolvedValue('dismissed');
    usePwaInstallStore.setState({ canPrompt: true });
    const { container } = render(<InstallPwaSection />);

    fireEvent.click(screen.getByRole('button', { name: 'settings.install.action' }));

    await waitFor(() => expect(container.innerHTML).toBe(''));
    expect(promptInstall).toHaveBeenCalledTimes(1);
    expect(usePwaInstallStore.getState().dismissed).toBe(true);
  });
});
