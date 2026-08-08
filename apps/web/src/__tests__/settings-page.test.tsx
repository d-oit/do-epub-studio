import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from '../features/settings/SettingsPage';
import { usePreferencesStore } from '../stores/preferences';
import { useAuthStore } from '../stores/auth';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../components/StorageQuota', () => ({
  StorageQuota: () => <div data-testid="storage-quota" />,
}));

vi.mock('../components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

function resetStores() {
  usePreferencesStore.setState({
    reader: {
      theme: 'system',
      fontFamily: 'serif',
      fontSize: 'medium',
      lineHeight: 2,
      pageWidth: 'normal',
      direction: 'default',
      writingMode: 'horizontal-tb',
    },
  });
  useAuthStore.setState({
    isAdmin: false,
  });
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it('renders settings title', () => {
    render(<SettingsPage />);
    expect(screen.getByText('settings.title')).toBeInTheDocument();
  });

  it('renders theme options', () => {
    render(<SettingsPage />);
    expect(screen.getByText('reader.settings.theme.light')).toBeInTheDocument();
    expect(screen.getByText('reader.settings.theme.dark')).toBeInTheDocument();
    expect(screen.getByText('reader.settings.theme.sepia')).toBeInTheDocument();
    expect(screen.getByText('reader.settings.theme.system')).toBeInTheDocument();
  });

  it('renders font size options', () => {
    render(<SettingsPage />);
    expect(screen.getByText('reader.settings.fontSize.small')).toBeInTheDocument();
    expect(screen.getByText('reader.settings.fontSize.medium')).toBeInTheDocument();
    expect(screen.getByText('reader.settings.fontSize.large')).toBeInTheDocument();
    expect(screen.getByText('reader.settings.fontSize.xlarge')).toBeInTheDocument();
  });

  it('renders font family options', () => {
    render(<SettingsPage />);
    expect(screen.getByText('reader.settings.fontFamily.serif')).toBeInTheDocument();
    expect(screen.getByText('reader.settings.fontFamily.sans-serif')).toBeInTheDocument();
    expect(screen.getByText('reader.settings.fontFamily.monospace')).toBeInTheDocument();
  });

  it('renders locale switcher', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('renders storage quota component', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('storage-quota')).toBeInTheDocument();
  });

  it('theme button has aria-pressed for selected state', () => {
    render(<SettingsPage />);
    const systemBtn = screen.getByText('reader.settings.theme.system');
    expect(systemBtn).toHaveAttribute('aria-pressed', 'true');
    const lightBtn = screen.getByText('reader.settings.theme.light');
    expect(lightBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking theme button changes selection', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByText('reader.settings.theme.dark'));
    expect(screen.getByText('reader.settings.theme.dark')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('reader.settings.theme.light')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders all three main sections', () => {
    render(<SettingsPage />);
    expect(screen.getByText('settings.readerPreferences')).toBeInTheDocument();
    expect(screen.getByText('settings.readerPreferencesHint')).toBeInTheDocument();
    expect(screen.getByTestId('storage-quota')).toBeInTheDocument();
    expect(screen.getByText('settings.account')).toBeInTheDocument();
  });

  it('renders theme switcher and locale switcher', () => {
    render(<SettingsPage />);
    expect(screen.getByText('reader.settings.theme.light')).toBeInTheDocument();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('renders admin badge when isAdmin is true', () => {
    useAuthStore.setState({ isAdmin: true });
    render(<SettingsPage />);
    expect(screen.getByText('settings.adminBadge')).toBeInTheDocument();
  });

  it('does not render admin badge when isAdmin is false', () => {
    useAuthStore.setState({ isAdmin: false });
    render(<SettingsPage />);
    expect(screen.queryByText('settings.adminBadge')).not.toBeInTheDocument();
  });

  it('renders line height options', () => {
    render(<SettingsPage />);
    expect(screen.getByText('settings.lineHeight')).toBeInTheDocument();
  });

  it('renders page width options', () => {
    render(<SettingsPage />);
    expect(screen.getByText('settings.pageWidth')).toBeInTheDocument();
  });

  it('renders direction options', () => {
    render(<SettingsPage />);
    expect(screen.getByText('reader.settings.direction')).toBeInTheDocument();
  });

  it('renders writing mode options', () => {
    render(<SettingsPage />);
    expect(screen.getByText('reader.settings.writingMode')).toBeInTheDocument();
  });
});
