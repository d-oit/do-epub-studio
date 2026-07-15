import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminRecoverPage } from '../features/admin/AdminRecoverPage';
import { apiRequest } from '../lib/api';
import { useAuthStore } from '../stores/auth';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      sessionToken: null,
      sessionExpiresAt: null,
      bookId: null,
      bookSlug: null,
      bookTitle: null,
      email: null,
      capabilities: null,
      isAuthenticated: false,
      isAdmin: false,
      sessionExpired: false,
      setAuth: vi.fn(),
      setAdminAuth: vi.fn(),
      refreshSession: vi.fn(),
      logout: vi.fn(),
    };
    return selector(state);
  }),
}));

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'admin.recover.titleRequest': 'Recover Admin Account',
        'admin.recover.titleVerify': 'Reset Password',
        'admin.recover.requestDescription': 'Enter your email to receive a recovery link.',
        'admin.recover.verifyDescription': 'Enter your new password.',
        'admin.recover.requestSent': 'Recovery link sent.',
        'admin.recover.requestFailed': 'Request failed.',
        'admin.recover.verifyFailed': 'Verification failed.',
        'admin.login.email': 'Email',
        'admin.recover.newPassword': 'New Password',
        'admin.recover.sending': 'Sending...',
        'admin.recover.sendLink': 'Send Recovery Link',
        'admin.recover.resetting': 'Resetting...',
        'admin.recover.resetPassword': 'Reset Password',
        'admin.recover.backToLogin': 'Back to Login',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('../components/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => {
    const id = props.id ?? `input-${label}`;
    return (
      <div>
        {label && <label htmlFor={id}>{label}</label>}
        <input id={id} {...props} />
      </div>
    );
  },
  AppLogo: () => <div data-testid="app-logo" />,
}));

describe('AdminRecoverPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders request mode when no token in URL', () => {
    render(
      <MemoryRouter initialEntries={['/admin/recover']}>
        <AdminRecoverPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Recover Admin Account')).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByText('Send Recovery Link')).toBeDefined();
  });

  it('renders verify mode when token in URL', () => {
    render(
      <MemoryRouter initialEntries={['/admin/recover?token=abc123']}>
        <AdminRecoverPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeDefined();
    expect(screen.getByLabelText('New Password')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeDefined();
  });

  it('submits recovery request and shows success', async () => {
    const user = userEvent.setup();
    vi.mocked(apiRequest).mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/admin/recover']}>
        <AdminRecoverPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.click(screen.getByText('Send Recovery Link'));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/admin/recovery-request', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@example.com' }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Recovery link sent.')).toBeDefined();
    });
  });

  it('shows error on failed request', async () => {
    const user = userEvent.setup();
    vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter initialEntries={['/admin/recover']}>
        <AdminRecoverPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.click(screen.getByText('Send Recovery Link'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });

  it('submits verify and updates auth store', async () => {
    const user = userEvent.setup();
    const mockSetAdminAuth = vi.fn();
    vi.mocked(useAuthStore).mockImplementation((selector) => {
      const state = {
        sessionToken: null,
        sessionExpiresAt: null,
        bookId: null,
        bookSlug: null,
        bookTitle: null,
        email: null,
        capabilities: null,
        isAuthenticated: false,
        isAdmin: false,
        sessionExpired: false,
        setAuth: vi.fn(),
        setAdminAuth: mockSetAdminAuth,
        refreshSession: vi.fn(),
        logout: vi.fn(),
      };
      return selector(state);
    });
    vi.mocked(apiRequest).mockResolvedValue({ sessionToken: 'token-123', email: 'admin@example.com' });

    render(
      <MemoryRouter initialEntries={['/admin/recover?token=abc123']}>
        <AdminRecoverPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('New Password'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/admin/recovery-verify', {
        method: 'POST',
        body: JSON.stringify({ token: 'abc123', newPassword: 'newpassword123' }),
      });
    });

    await waitFor(() => {
      expect(mockSetAdminAuth).toHaveBeenCalledWith({ sessionToken: 'token-123', email: 'admin@example.com' });
    });
  });

  it('shows error on failed verify', async () => {
    const user = userEvent.setup();
    vi.mocked(apiRequest).mockRejectedValue(new Error('Invalid token'));

    render(
      <MemoryRouter initialEntries={['/admin/recover?token=abc123']}>
        <AdminRecoverPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('New Password'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid token')).toBeDefined();
    });
  });
});
