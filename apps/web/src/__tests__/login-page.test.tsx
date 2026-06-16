import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { useAuthStore } from '../stores/auth';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'login.subtitle': 'Sign in to read',
        'login.emailLabel': 'Email',
        'login.emailPlaceholder': 'Enter your email',
        'login.passwordLabel': 'Password',
        'login.passwordPlaceholder': 'Enter your password',
        'login.forgotPassword': 'Forgot password?',
        'login.submit': 'Sign In',
        'login.signingIn': 'Signing in...',
        'login.adminLink': 'Admin Login',
        'login.adminDescription': 'For administrators',
        'login.recoveryTitle': 'Password Recovery',
        'login.recoveryInstructions': 'Enter your email to receive a recovery link',
        'login.sendMagicLink': 'Send Recovery Link',
        'login.backToLogin': 'Back to Login',
        'login.recoverySuccess': 'Recovery link sent!',
        'login.verifyingToken': 'Verifying token...',
        'login.bookSlugLabel': 'Book',
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
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Input: ({ label, id, ...props }: any) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} />
    </div>
  ),
  AppLogo: ({ size: _size, ...props }: any) => <div data-testid="app-logo" {...props} />,
}));

import { apiRequest } from '../lib/api';
const mockApiRequest = vi.mocked(apiRequest);

function renderLoginPage(searchParams = '') {
  return render(
    <MemoryRouter initialEntries={[`/login${searchParams ? `?${searchParams}` : ''}`]}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      sessionToken: null,
      bookId: null,
      bookSlug: null,
      email: null,
    });
  });

  it('renders login form', () => {
    renderLoginPage();
    expect(screen.getByText('Sign in to read')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('shows book slug when provided', () => {
    renderLoginPage('book=my-book');
    expect(screen.getByText('my-book')).toBeInTheDocument();
  });

  it('submits login form', async () => {
    mockApiRequest.mockResolvedValue({
      sessionToken: 'token-123',
      book: { id: 'book-1', slug: 'my-book', title: 'My Book', authorName: 'Author' },
      capabilities: null,
    });

    renderLoginPage();

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('/api/access/request', expect.any(Object));
    });
  });

  it('shows error on login failure', async () => {
    mockApiRequest.mockRejectedValue(new Error('Invalid credentials'));

    renderLoginPage();

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('switches to recovery mode', () => {
    renderLoginPage();
    fireEvent.click(screen.getByText('Forgot password?'));
    expect(screen.getByText('Password Recovery')).toBeInTheDocument();
  });

  it('submits recovery request', async () => {
    mockApiRequest.mockResolvedValue({});

    renderLoginPage();
    fireEvent.click(screen.getByText('Forgot password?'));
    const emailInputs = screen.getAllByRole('textbox');
    fireEvent.change(emailInputs[0], { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send Recovery Link'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('/api/access/recovery-request', expect.any(Object));
    });
  });

  it('shows admin login link', () => {
    renderLoginPage();
    expect(screen.getByText('Admin Login')).toBeInTheDocument();
  });

  it('renders theme toggle and locale switcher', () => {
    renderLoginPage();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });
});
