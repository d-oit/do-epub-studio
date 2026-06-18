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
  Button: ({ children, type, onClick, isLoading, loadingLabel, className }: any) => (
    <button type={type || 'button'} onClick={onClick} disabled={isLoading} className={className}>
      {isLoading ? loadingLabel : children}
    </button>
  ),
  Input: ({ id, label, type, value, onChange, placeholder, required, name, autoComplete, inputMode }: any) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
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
  });

  it('renders login form', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByLabelText('login.emailLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('login.passwordLabel')).toBeInTheDocument();
    expect(screen.getByText('login.submit')).toBeInTheDocument();
  });

  it('renders branding', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByText('do EPUB Studio')).toBeInTheDocument();
    expect(screen.getByTestId('app-logo')).toBeInTheDocument();
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
});
