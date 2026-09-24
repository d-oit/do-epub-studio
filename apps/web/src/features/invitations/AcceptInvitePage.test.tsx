import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AcceptInvitePage } from './AcceptInvitePage';
import { acceptBookInvitation } from '../../lib/api/invitations';

const mockNavigate = vi.fn();
const mockSetAuth = vi.fn();
const TOKEN = 'a'.repeat(64);
const PASSWORD = 'A-long-invite-passphrase!';

vi.mock('../../lib/api/invitations', () => ({
  acceptBookInvitation: vi.fn(),
}));
vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector: (state: { setAuth: typeof mockSetAuth }) => unknown) => selector({ setAuth: mockSetAuth }),
}));
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('../../components/ui', () => ({
  AppLogo: () => <div data-testid="app-logo" />,
  Button: ({ children, type, onClick, isLoading, loadingLabel, disabled, className }: React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean; loadingLabel?: React.ReactNode }) => (
    <button type={type || 'button'} onClick={onClick} disabled={disabled || isLoading} className={className}>{isLoading ? loadingLabel : children}</button>
  ),
  Input: ({ id, label, type, value, onChange, required, name, autoComplete }: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }) => (
    <div><label htmlFor={id}>{label}</label><input id={id} type={type} value={value} onChange={onChange} required={required} name={name} autoComplete={autoComplete} /></div>
  ),
}));
vi.mock('@do-epub-studio/ui', () => ({
  Spinner: ({ label }: { label?: string }) => <div role="status" aria-label={label} />,
}));

function response(role: 'reader' | 'creator' = 'reader') {
  return {
    sessionToken: 'session-token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    email: 'reader@example.com',
    role,
    book: { id: 'book-1', slug: 'book-one', title: 'Book One', authorName: null, visibility: 'private', coverImageUrl: null },
    capabilities: {
      canRead: true,
      canComment: true,
      canHighlight: true,
      canBookmark: true,
      canDownloadOffline: true,
      canExportNotes: true,
      canManageAccess: false,
    },
  };
}

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/accept-invite');
  });

  it('shows a safe invalid state when the fragment has no token', async () => {
    window.location.hash = '#other=value';
    render(<MemoryRouter><AcceptInvitePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('invitations.invalidTitle')).toBeInTheDocument());
    expect(screen.queryByLabelText('invitations.passwordLabel')).not.toBeInTheDocument();
  });

  it('accepts a reader invitation and removes the token from browser history', async () => {
    window.location.hash = `#token=${TOKEN}`;
    vi.mocked(acceptBookInvitation).mockResolvedValue(response());
    render(<MemoryRouter><AcceptInvitePage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('invitations.passwordLabel')).toBeInTheDocument());
    expect(window.location.hash).toBe('');
    fireEvent.change(screen.getByLabelText('invitations.passwordLabel'), { target: { value: PASSWORD } });
    fireEvent.change(screen.getByLabelText('invitations.passwordConfirmLabel'), { target: { value: PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: 'invitations.accept' }));

    await waitFor(() => expect(acceptBookInvitation).toHaveBeenCalledWith(TOKEN, PASSWORD, PASSWORD));
    expect(mockSetAuth).toHaveBeenCalledWith(expect.objectContaining({ sessionToken: 'session-token', email: 'reader@example.com' }));
    expect(mockNavigate).toHaveBeenCalledWith('/read/book-one');
  });

  it('routes an accepted creator to the creator workspace', async () => {
    window.location.hash = `#token=${TOKEN}`;
    vi.mocked(acceptBookInvitation).mockResolvedValue(response('creator'));
    render(<MemoryRouter><AcceptInvitePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('invitations.passwordLabel')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('invitations.passwordLabel'), { target: { value: PASSWORD } });
    fireEvent.change(screen.getByLabelText('invitations.passwordConfirmLabel'), { target: { value: PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: 'invitations.accept' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/creator'));
  });
});
