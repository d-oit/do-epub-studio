/* biome-ignore-all lint/correctness/useQwikValidLexicalScope: this project uses React, not Qwik */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AccountSettingsPage } from '../features/admin/AccountSettingsPage';
import { apiRequest } from '../lib/api';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: Object.assign(
    vi.fn((selector) => {
      const state = { sessionToken: 'tok-123' };
      return selector(state);
    }),
    { getState: () => ({ sessionToken: 'tok-123', refreshSession: vi.fn() }) },
  ),
}));

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../components/navigation', () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}));

vi.mock('../components/ui', () => ({
  Button: ({
    children,
    onClick,
    isLoading,
    loadingLabel,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    isLoading?: boolean;
    loadingLabel?: string;
    variant?: string;
    size?: string;
    type?: string;
  }) => (
    <button
      type={props.type === 'submit' ? 'submit' : 'button'}
      onClick={onClick}
      disabled={isLoading}
    >
      {isLoading ? loadingLabel || 'Loading...' : children}
    </button>
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
  Modal: ({ isOpen, children, footer }: { isOpen: boolean; children?: React.ReactNode; footer?: React.ReactNode }) =>
    isOpen ? (
      <div role="dialog">
        {children}
        {footer}
      </div>
    ) : null,
  ConfirmDialog: ({ isOpen, description, confirmLabel, onConfirm, onCancel }: { isOpen: boolean; description?: string; confirmLabel?: string; onConfirm?: () => void; onCancel?: () => void }) =>
    isOpen ? (
      <div role="alertdialog">
        {description && <p>{description}</p>}
        <button onClick={onConfirm}>{confirmLabel ?? 'Confirm'}</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

const sessions = {
  sessions: [
    {
      id: 'sess-abc-123',
      created_at: '2026-08-01T10:00:00Z',
      last_used_at: '2026-08-13T10:00:00Z',
      expires_at: '2026-09-01T10:00:00Z',
      assurance_level: 'password',
      device_label_hash: '',
      current: true,
    },
  ],
};

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiRequest).mockImplementation((endpoint: string) => {
      if (endpoint === '/api/admin/account/sessions') return Promise.resolve(sessions);
      if (endpoint === '/api/admin/account/mfa/status') {
        return Promise.resolve({
          mfaEnrolled: false,
          method: null,
          enrolledAt: null,
          passkeys: [],
          recoveryCodesPresent: false,
        });
      }
      return Promise.resolve({ ok: true });
    });
  });

  it('renders the change password form and sessions section', () => {
    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'admin.account.title' })).toBeInTheDocument();
    expect(screen.getByLabelText('admin.account.currentPassword')).toBeInTheDocument();
    expect(screen.getByLabelText('admin.account.newPassword')).toBeInTheDocument();
    expect(screen.getByLabelText('admin.account.newPasswordConfirm')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'admin.sessions.title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'admin.account.changePassword' })).toBeInTheDocument();
  });

  it('loads active sessions with the bearer token', async () => {
    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/admin/account/sessions', { token: 'tok-123' });
    });
    expect(await screen.findByText(/ID: sess-abc/)).toBeInTheDocument();
  });

  it('posts a password change with currentPassword, newPassword and confirm', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('admin.account.currentPassword'), 'oldpass123');
    await user.type(screen.getByLabelText('admin.account.newPassword'), 'newpass123');
    await user.type(screen.getByLabelText('admin.account.newPasswordConfirm'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'admin.account.changePassword' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/admin/account/password-change', {
        method: 'POST',
        token: 'tok-123',
        body: JSON.stringify({
          currentPassword: 'oldpass123',
          newPassword: 'newpass123',
          newPasswordConfirm: 'newpass123',
        }),
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent('admin.account.passwordChangeSuccess');
  });

  it('shows an error when the password change fails', async () => {
    const user = userEvent.setup();
    vi.mocked(apiRequest).mockImplementation((endpoint: string) =>
      endpoint === '/api/admin/account/sessions'
        ? Promise.resolve(sessions)
        : endpoint === '/api/admin/account/mfa/status'
          ? Promise.resolve({ mfaEnrolled: false, method: null, enrolledAt: null, passkeys: [], recoveryCodesPresent: false })
          : Promise.reject(new Error('bad current password')),
    );

    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('admin.account.currentPassword'), 'wrongpass');
    await user.type(screen.getByLabelText('admin.account.newPassword'), 'newpass123');
    await user.type(screen.getByLabelText('admin.account.newPasswordConfirm'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'admin.account.changePassword' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('admin.account.passwordChangeFailed');
  });

  it('signs out all other sessions via POST logout-all', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'admin.sessions.logoutAll' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/admin/account/logout-all', {
        method: 'POST',
        token: 'tok-123',
      });
    });
  });
});
