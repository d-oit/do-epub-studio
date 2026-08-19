import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

const mockNavigate = vi.fn();
const mockUseSearchParams = vi.fn(() => [new URLSearchParams(), vi.fn()]);

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockIsDemoLoginEnabled = vi.fn();
const mockResolveHelpUrl = vi.fn();
vi.mock('../../config/demo-config', () => ({
  isDemoLoginEnabled: () => mockIsDemoLoginEnabled(),
  resolveHelpUrl: () => mockResolveHelpUrl(),
  DEMO_READER_EMAIL: 'demo.reader@example.local',
  DEMO_READER_PASSWORD: 'demo-reader-password',
  DEMO_ADMIN_EMAIL: 'demo.admin@example.local',
  DEMO_ADMIN_PASSWORD: 'demo-admin-password',
  DEMO_BOOK_SLUG: 'demo',
}));
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('../../components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

vi.mock('../../components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('../../components/ui', () => ({
  Button: ({ children, type, onClick, isLoading, loadingLabel, className }: React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean; loadingLabel?: React.ReactNode; children?: React.ReactNode }) => (
    <button type={type || 'button'} onClick={onClick} disabled={isLoading} className={className}>
      {isLoading ? loadingLabel : children}
    </button>
  ),
  Input: ({ id, label, type, value, onChange, placeholder, required, name, autoComplete, inputMode, ref, showPasswordLabel }: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode; ref?: React.Ref<HTMLInputElement>; showPasswordLabel?: string }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        ref={ref}
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        name={name}
        autoComplete={autoComplete}
        inputMode={inputMode}
      />
      {type === 'password' && showPasswordLabel && (
        <button type="button" aria-expanded={false}>{showPasswordLabel}</button>
      )}
    </div>
  ),
  AppLogo: () => <div data-testid="app-logo" />,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => mockUseSearchParams(),
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
    useAuthStore.setState({
      sessionToken: null,
      bookId: null,
      bookSlug: null,
      bookTitle: null,
      email: null,
      capabilities: null,
    });
    mockIsDemoLoginEnabled.mockReturnValue(false);
    mockResolveHelpUrl.mockReturnValue(null);
  });

  it('renders login form', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByLabelText('login.emailLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('login.passwordLabel')).toBeInTheDocument();
    expect(screen.getByText('login.submit')).toBeInTheDocument();
  });

  it('renders branding', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getAllByText('d.o.EPUB Studio').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('app-logo').length).toBeGreaterThan(0);
  });

  it('renders admin link', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByText('login.adminLink')).toBeInTheDocument();
  });

  it('navigates to admin login', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('login.adminLink'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/login');
  });

  it('handles successful login', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      sessionToken: 'test-token',
      expiresAt: '2026-12-31T00:00:00Z',
      book: { id: 'book-1', slug: 'my-book', title: 'My Book', authorName: 'Author' },
      capabilities: { canRead: true, canComment: true, canHighlight: true, canBookmark: true, canDownloadOffline: false, canExportNotes: false, canManageAccess: false },
    });

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('login.emailLabel'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText('login.passwordLabel'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByText('login.submit'));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/access/request', expect.objectContaining({ method: 'POST' }));
      expect(mockNavigate).toHaveBeenCalledWith('/read/my-book');
    });
  });

  it('handles login error', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Invalid credentials'));

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('login.emailLabel'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText('login.passwordLabel'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('login.submit'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows recovery mode', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('login.forgotPassword'));
    expect(screen.getByText('login.recoveryTitle')).toBeInTheDocument();
    expect(screen.getByText('login.sendMagicLink')).toBeInTheDocument();
    expect(screen.getByText('login.recoveryInstructions')).toBeInTheDocument();
  });

  it('handles recovery request', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('login.forgotPassword'));
    fireEvent.change(screen.getByLabelText('login.emailLabel'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByText('login.sendMagicLink'));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/access/recovery-request', expect.objectContaining({ method: 'POST' }));
      expect(screen.getByText('login.recoverySuccess')).toBeInTheDocument();
    });
  });

  it('handles recovery request error', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Email not found'));

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('login.forgotPassword'));
    fireEvent.change(screen.getByLabelText('login.emailLabel'), { target: { value: 'bad@test.com' } });
    fireEvent.click(screen.getByText('login.sendMagicLink'));

    await waitFor(() => {
      expect(screen.getByText('Email not found')).toBeInTheDocument();
    });
  });

  it('back to login from recovery mode', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('login.forgotPassword'));
    expect(screen.getByText('login.recoveryTitle')).toBeInTheDocument();

    fireEvent.click(screen.getByText('login.backToLogin'));
    expect(screen.getByText('login.subtitle')).toBeInTheDocument();
  });

  it('shows recovery success and back to login', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('login.forgotPassword'));
    fireEvent.change(screen.getByLabelText('login.emailLabel'), { target: { value: 'user@test.com' } });
    fireEvent.click(screen.getByText('login.sendMagicLink'));

    await waitFor(() => {
      expect(screen.getByText('login.recoverySuccess')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('login.backToLogin'));
    expect(screen.getByText('login.subtitle')).toBeInTheDocument();
  });

  it('renders theme toggle and locale switcher', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('renders admin description', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByText('login.adminDescription')).toBeInTheDocument();
  });

  it('auto-verifies recovery token on mount', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      sessionToken: 'recovery-token',
      expiresAt: null,
      book: { id: 'book-1', slug: 'recovered-book', title: 'Recovered', authorName: 'A' },
      capabilities: { canRead: true, canComment: false, canHighlight: false, canBookmark: false, canDownloadOffline: false, canExportNotes: false, canManageAccess: false },
    });

    const realSearchParams = new URLSearchParams();
    realSearchParams.set('token', 'recovery-abc-123');

    mockUseSearchParams.mockReturnValue([realSearchParams, vi.fn()]);

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/access/verify-recovery', expect.objectContaining({ method: 'POST' }));
      expect(mockNavigate).toHaveBeenCalledWith('/read/recovered-book');
    });
  });

  it('handles recovery token verification error', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Invalid token'));

    const realSearchParams = new URLSearchParams();
    realSearchParams.set('token', 'bad-token');

    mockUseSearchParams.mockReturnValue([realSearchParams, vi.fn()]);

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('Invalid token')).toBeInTheDocument();
    });
  });

  it('shows verifying loading state for recovery token', async () => {
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));

    const realSearchParams = new URLSearchParams();
    realSearchParams.set('token', 'pending-token');

    mockUseSearchParams.mockReturnValue([realSearchParams, vi.fn()]);

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('login.verifyingToken')).toBeInTheDocument();
    });
  });

  it('handles login without expiresAt', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      sessionToken: 'no-expire-token',
      book: { id: 'book-2', slug: 'book-two', title: 'Book Two', authorName: 'B' },
      capabilities: null,
    });

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('login.emailLabel'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText('login.passwordLabel'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByText('login.submit'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/read/book-two');
    });
  });

  describe('demo login', () => {
    it('hides demo button when demo login is disabled', () => {
      mockIsDemoLoginEnabled.mockReturnValue(false);
      render(<MemoryRouter><LoginPage /></MemoryRouter>);
      expect(screen.queryByText('login.demoTry')).not.toBeInTheDocument();
      expect(screen.queryByText('login.demoFillCredentials')).not.toBeInTheDocument();
    });

    it('shows demo button when demo login is enabled', () => {
      mockIsDemoLoginEnabled.mockReturnValue(true);
      render(<MemoryRouter><LoginPage /></MemoryRouter>);
      expect(screen.getByText('login.demoTry')).toBeInTheDocument();
      expect(screen.getByText('login.demoOr')).toBeInTheDocument();
    });

    it('fills demo credentials into the form fields', () => {
      mockIsDemoLoginEnabled.mockReturnValue(true);
      render(<MemoryRouter><LoginPage /></MemoryRouter>);

      fireEvent.click(screen.getByText('login.demoFillCredentials'));

      expect(screen.getByLabelText('login.emailLabel')).toHaveValue('demo.reader@example.local');
      expect(screen.getByLabelText('login.passwordLabel')).toHaveValue('demo-reader-password');
    });

    it('handles successful demo login', async () => {
      mockIsDemoLoginEnabled.mockReturnValue(true);
      vi.mocked(apiRequest).mockResolvedValueOnce({
        sessionToken: 'demo-tok',
        book: { id: 'b1', slug: 'demo', title: 'Demo Book', authorName: 'Author' },
        capabilities: null,
      });

      render(<MemoryRouter><LoginPage /></MemoryRouter>);
      fireEvent.click(screen.getByText('login.demoTry'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/read/demo');
      });
    });

    it('shows error on demo login failure', async () => {
      mockIsDemoLoginEnabled.mockReturnValue(true);
      vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Demo disabled'));

      render(<MemoryRouter><LoginPage /></MemoryRouter>);
      fireEvent.click(screen.getByText('login.demoTry'));

      await waitFor(() => {
        expect(screen.getByText('Demo disabled')).toBeInTheDocument();
      });
    });
  });

  describe('hero and app info', () => {
    it('renders the four feature bullets', () => {
      render(<MemoryRouter><LoginPage /></MemoryRouter>);
      // Hero (desktop) and mobile info both render the shared feature list.
      expect(screen.getAllByText('login.hero.feature.reading').length).toBeGreaterThan(0);
      expect(screen.getAllByText('login.hero.feature.annotations').length).toBeGreaterThan(0);
      expect(screen.getAllByText('login.hero.feature.offline').length).toBeGreaterThan(0);
      expect(screen.getAllByText('login.hero.feature.management').length).toBeGreaterThan(0);
    });

    it('renders the access note and hero help link', () => {
      mockResolveHelpUrl.mockReturnValue({ href: '/help', isExternal: false });
      render(<MemoryRouter><LoginPage /></MemoryRouter>);
      expect(screen.getAllByText('login.hero.howAccessWorks').length).toBeGreaterThan(0);
      const heroLink = screen.getByText('login.hero.learnMore').closest('a');
      expect(heroLink).toHaveAttribute('href', '/help');
    });

    it('renders the show/hide password toggle', () => {
      render(<MemoryRouter><LoginPage /></MemoryRouter>);
      expect(screen.getByText('ui.showPassword')).toBeInTheDocument();
    });
  });

  describe('help link', () => {
    it('hides help link when no help URL configured', () => {
      mockResolveHelpUrl.mockReturnValue(null);
      render(<MemoryRouter><LoginPage /></MemoryRouter>);
      expect(screen.queryByText('login.helpLink')).not.toBeInTheDocument();
    });

    it('renders help link with correct href for external URL', () => {
      mockResolveHelpUrl.mockReturnValue({ href: 'https://help.example.com', isExternal: true });
      render(<MemoryRouter><LoginPage /></MemoryRouter>);
      const link = screen.getByText('login.helpLink').closest('a');
      expect(link).toHaveAttribute('href', 'https://help.example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders help link without external attrs for internal URL', () => {
      mockResolveHelpUrl.mockReturnValue({ href: 'http://localhost/help', isExternal: false });
      render(<MemoryRouter><LoginPage /></MemoryRouter>);
      const link = screen.getByText('login.helpLink').closest('a');
      expect(link).toHaveAttribute('href', 'http://localhost/help');
      expect(link).not.toHaveAttribute('target', '_blank');
    });
  });
});
