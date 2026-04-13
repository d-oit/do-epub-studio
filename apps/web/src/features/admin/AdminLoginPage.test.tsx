import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

// Mock apiRequest
vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

// Mock useAuthStore
vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    sessionToken: null,
    setAdminAuth: vi.fn(),
  }),
}));

import { apiRequest } from '../../lib/api';

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        sessionToken: 'test-token',
        email: 'admin@example.com',
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

    it('navigates to /admin/books on successful login', async () => {
      const user = userEvent.setup();
      vi.mocked(apiRequest).mockResolvedValueOnce({
        sessionToken: 'test-token',
        email: 'admin@example.com',
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
});