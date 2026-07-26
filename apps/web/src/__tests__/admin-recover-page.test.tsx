import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminRecoverPage } from '../features/admin/AdminRecoverPage';
import { apiRequest } from '../lib/api';
import { logClientEvent } from '../lib/client-logger';
import { useAuthStore } from '../stores/auth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
      // eslint-disable-next-line security/detect-object-injection -- static mock lookup
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

vi.mock('../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

describe('AdminRecoverPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request mode (no token)', () => {
    it('renders the request form', () => {
      render(
        <MemoryRouter initialEntries={['/admin/recover']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );
      expect(screen.getByText('Recover Admin Account')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send Recovery Link' })).toBeInTheDocument();
    });

    it('calls POST /api/admin/recovery-request on submit', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockResolvedValue(undefined);

      render(
        <MemoryRouter initialEntries={['/admin/recover']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('Email'), 'admin@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Recovery Link' }));

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/api/admin/recovery-request', {
          method: 'POST',
          body: JSON.stringify({ email: 'admin@example.com' }),
        });
      });
    });

    it('shows success info after successful request', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockResolvedValue(undefined);

      render(
        <MemoryRouter initialEntries={['/admin/recover']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('Email'), 'admin@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Recovery Link' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Recovery link sent.');
      });
    });

    it('shows error on failed request', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));

      render(
        <MemoryRouter initialEntries={['/admin/recover']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('Email'), 'admin@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Recovery Link' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error');
      });
    });
  });

  describe('verify mode (token in URL)', () => {
    it('renders the verify form', () => {
      render(
        <MemoryRouter initialEntries={['/admin/recover?token=abc123']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument();
    });

    it('calls POST /api/admin/recovery-verify on submit and updates auth store', async () => {
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
      vi.mocked(apiRequest).mockResolvedValue({ sessionToken: 'tok', email: 'a@b.com' });

      render(
        <MemoryRouter initialEntries={['/admin/recover?token=abc123']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('New Password'), 'supersecretpw1');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/api/admin/recovery-verify', {
          method: 'POST',
          body: JSON.stringify({ token: 'abc123', newPassword: 'supersecretpw1' }),
        });
      });

      await waitFor(() => {
        expect(mockSetAdminAuth).toHaveBeenCalledWith({ sessionToken: 'tok', email: 'a@b.com' });
      });
    });

    it('navigates to /admin/books after successful verify', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockResolvedValue({ sessionToken: 'tok', email: 'a@b.com' });

      render(
        <MemoryRouter initialEntries={['/admin/recover?token=abc123']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('New Password'), 'supersecretpw1');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/books');
      });
    });

    it('shows error on failed verify', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockRejectedValue(new Error('Invalid token'));

      render(
        <MemoryRouter initialEntries={['/admin/recover?token=abc123']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('New Password'), 'supersecretpw1');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid token');
      });
    });
  });

  describe('password validation', () => {
    it('enforces minLength of 12 on the password input', () => {
      render(
        <MemoryRouter initialEntries={['/admin/recover?token=abc123']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );
      const passwordInput = screen.getByLabelText('New Password');
      expect(passwordInput).toHaveAttribute('minlength', '12');
    });
  });

  describe('Back to Login link', () => {
    it('navigates to /admin/login when clicked', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={['/admin/recover']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.click(screen.getByRole('button', { name: 'Back to Login' }));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/login');
    });
  });

  describe('loading state', () => {
    it('disables button and shows loading text during request submit', async () => {
      const user = userEvent.setup();
      let resolveRequest: () => void;
      vi.mocked(apiRequest).mockImplementation(
        () => new Promise<void>((resolve) => { resolveRequest = resolve; }),
      );

      render(
        <MemoryRouter initialEntries={['/admin/recover']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('Email'), 'admin@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Recovery Link' }));

      const button = screen.getByRole('button', { name: 'Sending...' });
      expect(button).toBeDisabled();

      resolveRequest!();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Send Recovery Link' })).not.toBeDisabled();
      });
    });

    it('disables button and shows loading text during verify submit', async () => {
      const user = userEvent.setup();
      let resolveVerify: () => void;
      vi.mocked(apiRequest).mockImplementation(
        () => new Promise<never>((resolve) => { resolveVerify = resolve; }),
      );

      render(
        <MemoryRouter initialEntries={['/admin/recover?token=abc123']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('New Password'), 'supersecretpw1');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      const button = screen.getByRole('button', { name: 'Resetting...' });
      expect(button).toBeDisabled();

      resolveVerify!();
    });
  });

  describe('error fallback', () => {
    it('shows generic request failed message when error has no message', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockRejectedValue('string error');

      render(
        <MemoryRouter initialEntries={['/admin/recover']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('Email'), 'admin@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Recovery Link' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Request failed.');
      });
    });

    it('shows generic verify failed message when error has no message', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockRejectedValue('string error');

      render(
        <MemoryRouter initialEntries={['/admin/recover?token=abc123']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('New Password'), 'supersecretpw1');
      await user.click(screen.getByRole('button', { name: 'Reset Password' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Verification failed.');
      });
    });
  });

  describe('logging', () => {
    it('calls logClientEvent on mount with mode metadata', () => {
      render(
        <MemoryRouter initialEntries={['/admin/recover']}>
          <AdminRecoverPage />
        </MemoryRouter>,
      );

      expect(logClientEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          event: 'admin.recover.view',
          metadata: { mode: 'request' },
        }),
      );
    });
  });
});
