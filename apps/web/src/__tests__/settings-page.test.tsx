import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from '../features/settings/SettingsPage';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../components/StorageQuota', () => ({
  StorageQuota: () => <div data-testid="storage-quota" />,
}));

vi.mock('../components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
