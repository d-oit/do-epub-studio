import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminLoginPage } from './AdminLoginPage';
import { BrowserRouter } from 'react-router-dom';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: () => null,
  };
});

// Mock useTranslation hook
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock apiRequest - default returns empty to avoid undefined errors
vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn().mockResolvedValue(null),
}));

const mockIsDemoLoginEnabled = vi.fn();
const mockResolveHelpUrl = vi.fn();
vi.mock('../../config/demo-config', () => ({
  isDemoLoginEnabled: () => mockIsDemoLoginEnabled(),
  resolveHelpUrl: () => mockResolveHelpUrl(),
  DEMO_ADMIN_EMAIL: 'demo.admin@example.local',
  DEMO_ADMIN_PASSWORD: 'demo-admin-password',
}));

// Mock useAuthStore
const mockSetAdminAuth = vi.fn();
vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { sessionToken: null, setAdminAuth: mockSetAdminAuth };
    return selector ? selector(state) : state;
  },
}));

import { apiRequest } from '../../lib/api';
import * as webauthnBrowser from '@simplewebauthn/browser';

vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(),
}));

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDemoLoginEnabled.mockReturnValue(false);
    mockResolveHelpUrl.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderLoginPage = () => {
    return render(
      <BrowserRouter>
        <AdminLoginPage />
      </BrowserRouter>,
    );
  };

  describe('rendering', () => {
    it('renders login form title', () => {
      renderLoginPage();

      expect(screen.getByText('admin.login.title')).toBeInTheDocument();
    });

    it('renders email input with label', () => {
      renderLoginPage();

      expect(screen.getByLabelText('admin.login.email')).toBeInTheDocument();
    });

    it('renders password input with label', () => {
      renderLoginPage();

      expect(screen.getByLabelText('admin.login.password')).toBeInTheDocument();
    });

    it('renders submit button', () => {
      renderLoginPage();

      expect(screen.getByRole('button', { name: 'admin.login.signIn' })).toBeInTheDocument();
    });

    it('renders back to reader link', () => {
      renderLoginPage();

      expect(screen.getByText('admin.login.backToReader')).toBeInTheDocument();
    });

    it('renders locale switcher', () => {
      renderLoginPage();

      // LocaleSwitcher component should be present - look for a button in the header area
      const localeButtons = screen.getAllByRole('button');
      expect(localeButtons.length).toBeGreaterThan(1);
    });
  });

  describe('form inputs', () => {
    it('allows typing in email input', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText('admin.login.email');
      await user.type(emailInput, 'admin@example.com');

      expect(emailInput).toHaveValue('admin@example.com');
    });

    it('allows typing in password input', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const passwordInput = screen.getByLabelText('admin.login.password');
      await user.type(passwordInput, 'password123');

      expect(passwordInput).toHaveValue('password123');
    });

    it('email input has required attribute', () => {
      renderLoginPage();

      expect(screen.getByLabelText('admin.login.email')).toBeRequired();
    });

    it('password input has required attribute', () => {
      renderLoginPage();

      expect(screen.getByLabelText('admin.login.password')).toBeRequired();
    });
  });

  describe('login flow', () => {
    it('calls apiRequest with correct params on submit', async () => {
      const user = userEvent.setup();
      const mockApiRequest = vi.mocked(apiRequest);
      mockApiRequest.mockResolvedValueOnce({
        token: 'test-token',
        user: { id: 'u1', email: 'admin@example.com', role: 'admin' },
      });

      renderLoginPage();

      await user.type(screen.getByLabelText('admin.login.email'), 'admin@example.com');
      await user.type(screen.getByLabelText('admin.login.password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'admin.login.signIn' }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/login', {
          method: 'POST',
          body: JSON.stringify({
            email: 'admin@example.com',
            password: 'password123',
          }),
        });
      });
    });

    it('stores the token and user email in the auth store', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockResolvedValueOnce({
        token: 'tok-123',
        user: { id: 'u1', email: 'admin@example.com', role: 'admin' },
      });

      renderLoginPage();

      await user.type(screen.getByLabelText('admin.login.email'), 'admin@example.com');
      await user.type(screen.getByLabelText('admin.login.password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'admin.login.signIn' }));

      await waitFor(() => {
        expect(mockSetAdminAuth).toHaveBeenCalledWith({
          sessionToken: 'tok-123',
          email: 'admin@example.com',
        });
      });
    });

    it('navigates to /admin/books on successful login', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockResolvedValueOnce({
        token: 'test-token',
        user: { id: 'u1', email: 'admin@example.com', role: 'admin' },
      });

      renderLoginPage();

      await user.type(screen.getByLabelText('admin.login.email'), 'admin@example.com');
      await user.type(screen.getByLabelText('admin.login.password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'admin.login.signIn' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/books');
      });
    });

    it('shows error message on login failure', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Invalid credentials'));

      renderLoginPage();

      await user.type(screen.getByLabelText('admin.login.email'), 'admin@example.com');
      await user.type(screen.getByLabelText('admin.login.password'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: 'admin.login.signIn' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });

    it('shows loading state during login', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      renderLoginPage();

      await user.type(screen.getByLabelText('admin.login.email'), 'admin@example.com');
      await user.type(screen.getByLabelText('admin.login.password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'admin.login.signIn' }));

      // Button should show loading text
      expect(screen.getByText('admin.login.signingIn')).toBeInTheDocument();
    });

    it('disables submit button during loading', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      renderLoginPage();

      await user.type(screen.getByLabelText('admin.login.email'), 'admin@example.com');
      await user.type(screen.getByLabelText('admin.login.password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'admin.login.signIn' }));

      expect(screen.getByRole('button', { name: 'admin.login.signingIn' })).toBeDisabled();
    });
  });

  describe('navigation', () => {
    it('navigates to /login when clicking back to reader', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await user.click(screen.getByText('admin.login.backToReader'));

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('MFA second factor', () => {
    const mfaUser = { id: 'u1', email: 'admin@example.com', role: 'admin' };

    it('renders the second-factor step and issues no session when mfa is required', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({ mfaRequired: true, user: mfaUser });
      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('admin.login.email'), 'admin@example.com');
      await user.type(screen.getByLabelText('admin.login.password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'admin.login.signIn' }));

      await waitFor(() => {
        expect(screen.getByText('admin.login.usePasskey')).toBeInTheDocument();
        expect(screen.getByText('admin.login.useRecoveryCode')).toBeInTheDocument();
      });
      expect(mockSetAdminAuth).not.toHaveBeenCalled();
    });

    it('passkey path starts and verifies a ceremony, then stores auth', async () => {
      const mockApi = vi.mocked(apiRequest);
      mockApi
        .mockResolvedValueOnce({ mfaRequired: true, loginTicket: 'ticket-1', user: mfaUser })
        .mockResolvedValueOnce({ options: { challenge: 'chal-x' } })
        .mockResolvedValueOnce({ token: 'mfa-token', user: mfaUser });
      vi.mocked(webauthnBrowser.startAuthentication).mockResolvedValue({ id: 'cred-1' } as never);

      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('admin.login.email'), 'admin@example.com');
      await user.type(screen.getByLabelText('admin.login.password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'admin.login.signIn' }));

      await waitFor(() => expect(screen.getByText('admin.login.usePasskey')).toBeInTheDocument());
      await user.click(screen.getByText('admin.login.usePasskey'));

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith('/api/admin/login/mfa/start', {
          method: 'POST',
          body: JSON.stringify({ loginTicket: 'ticket-1' }),
        });
      });
      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith('/api/admin/login/mfa/verify', {
          method: 'POST',
          body: JSON.stringify({ loginTicket: 'ticket-1', authenticationResponse: { id: 'cred-1' } }),
        });
      });
      await waitFor(() => {
        expect(mockSetAdminAuth).toHaveBeenCalledWith({ sessionToken: 'mfa-token', email: 'admin@example.com' });
      });
    });

    it('recovery path redeems a code and stores auth', async () => {
      const mockApi = vi.mocked(apiRequest);
      mockApi
        .mockResolvedValueOnce({ mfaRequired: true, user: mfaUser })
        .mockResolvedValueOnce({ token: 'recovery-token', user: mfaUser });

      const user = userEvent.setup();
      renderLoginPage();

      await user.type(screen.getByLabelText('admin.login.email'), 'admin@example.com');
      await user.type(screen.getByLabelText('admin.login.password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'admin.login.signIn' }));

      await waitFor(() => expect(screen.getByText('admin.login.useRecoveryCode')).toBeInTheDocument());
      await user.click(screen.getByText('admin.login.useRecoveryCode'));

      const codeInput = screen.getByLabelText('admin.login.recoveryCode');
      await user.type(codeInput, '0123456789abcdef');
      await user.click(screen.getByRole('button', { name: 'admin.login.verifyRecovery' }));

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith('/api/admin/login/mfa/recovery-verify', {
          method: 'POST',
          body: JSON.stringify({ email: 'admin@example.com', password: 'password123', recoveryCode: '0123456789abcdef' }),
        });
      });
      await waitFor(() => {
        expect(mockSetAdminAuth).toHaveBeenCalledWith({ sessionToken: 'recovery-token', email: 'admin@example.com' });
      });
    });
  });

  describe('demo login', () => {
    it('hides demo button when demo login is disabled', () => {
      mockIsDemoLoginEnabled.mockReturnValue(false);
      renderLoginPage();
      expect(screen.queryByText('admin.login.demoAdmin')).not.toBeInTheDocument();
    });

    it('shows demo button when demo login is enabled', () => {
      mockIsDemoLoginEnabled.mockReturnValue(true);
      renderLoginPage();
      expect(screen.getByText('admin.login.demoAdmin')).toBeInTheDocument();
    });

    it('handles successful demo admin login', async () => {
      mockIsDemoLoginEnabled.mockReturnValue(true);
      vi.mocked(apiRequest).mockResolvedValueOnce({
        token: 'demo-admin-tok',
        user: { id: 'u1', email: 'demo.admin@example.local', role: 'admin' },
      });

      renderLoginPage();
      fireEvent.click(screen.getByText('admin.login.demoAdmin'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/books');
      });
    });

    it('shows error on demo admin login failure', async () => {
      mockIsDemoLoginEnabled.mockReturnValue(true);
      vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Demo disabled'));

      renderLoginPage();
      fireEvent.click(screen.getByText('admin.login.demoAdmin'));

      await waitFor(() => {
        expect(screen.getByText('Demo disabled')).toBeInTheDocument();
      });
    });
  });

  describe('help link', () => {
    it('hides help link when no help URL configured', () => {
      mockResolveHelpUrl.mockReturnValue(null);
      renderLoginPage();
      expect(screen.queryByText('admin.login.helpLink')).not.toBeInTheDocument();
    });

    it('renders help link with correct href and rel for external URL', () => {
      mockResolveHelpUrl.mockReturnValue({ href: 'https://help.example.com', isExternal: true });
      renderLoginPage();
      const link = screen.getByText('admin.login.helpLink').closest('a');
      expect(link).toHaveAttribute('href', 'https://help.example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
