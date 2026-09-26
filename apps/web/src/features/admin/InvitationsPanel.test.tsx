import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InvitationsPanel } from './InvitationsPanel';
import {
  createBookInvitation,
  fetchBookInvitations,
  resendBookInvitation,
  revokeBookInvitation,
  type BookInvitation,
} from '../../lib/api/invitations';

const mockExecuteWithStepUp = vi.fn();
const bookId = '550e8400-e29b-41d4-a716-446655440000';

vi.mock('../../lib/api/invitations', () => ({
  createBookInvitation: vi.fn(),
  fetchBookInvitations: vi.fn(),
  resendBookInvitation: vi.fn(),
  revokeBookInvitation: vi.fn(),
}));
vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector: (state: { sessionToken: string | null }) => unknown) =>
    selector({ sessionToken: 'admin-token' }),
}));
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
vi.mock('../../components/ui', () => ({
  Button: ({
    children,
    type,
    onClick,
    isLoading,
    loadingLabel,
    disabled,
    className,
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean;
    loadingLabel?: React.ReactNode;
  }) => (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={className}
    >
      {isLoading ? loadingLabel : children}
    </button>
  ),
  Input: ({
    label,
    type,
    value,
    onChange,
    required,
  }: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }) => (
    <label>
      {label}
      <input type={type} value={value} onChange={onChange} required={required} />
    </label>
  ),
}));
vi.mock('@do-epub-studio/ui', () => ({
  Spinner: () => <div role="status" />,
}));

function invitation(overrides: Partial<BookInvitation> = {}): BookInvitation {
  return {
    id: 'invite-1',
    bookId,
    email: 'reader@example.com',
    role: 'reader',
    status: 'pending',
    deliveryStatus: 'manual_copy_required',
    deliveryErrorCode: null,
    grantMode: 'private',
    commentsAllowed: false,
    offlineAllowed: false,
    grantExpiresAt: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    acceptedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

describe('InvitationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchBookInvitations).mockResolvedValue([]);
    mockExecuteWithStepUp.mockImplementation((fn: (token: string) => Promise<unknown>) =>
      fn('step-up-token'),
    );
    vi.mocked(createBookInvitation).mockResolvedValue({
      invitation: invitation(),
      delivery: 'manual_copy_required',
      copyUrl: 'https://app.example.com/accept-invite#token=secret',
    });
    vi.mocked(resendBookInvitation).mockResolvedValue({
      invitation: invitation(),
      delivery: 'manual_copy_required',
      copyUrl: 'https://app.example.com/accept-invite#token=new-secret',
    });
    vi.mocked(revokeBookInvitation).mockResolvedValue({ id: 'invite-1', status: 'revoked' });
  });

  it('creates a reader invitation and exposes the manual delivery link', async () => {
    render(<InvitationsPanel bookId={bookId} executeWithStepUp={mockExecuteWithStepUp} />);
    fireEvent.click(screen.getByRole('button', { name: 'invitations.invitePerson' }));
    fireEvent.change(screen.getByLabelText('invitations.emailLabel'), {
      target: { value: 'new-reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'invitations.sendInvite' }));

    await waitFor(() =>
      expect(createBookInvitation).toHaveBeenCalledWith(
        bookId,
        expect.objectContaining({ email: 'new-reader@example.com', role: 'reader' }),
        'step-up-token',
      ),
    );
    expect(await screen.findByText('invitations.manualDelivery')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('https://app.example.com/accept-invite#token=secret'),
    ).toBeInTheDocument();
  });

  it('resends and revokes a pending invitation through step-up', async () => {
    vi.mocked(fetchBookInvitations).mockResolvedValue([invitation()]);
    render(<InvitationsPanel bookId={bookId} executeWithStepUp={mockExecuteWithStepUp} />);
    await screen.findByText('reader@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'invitations.resend' }));
    await waitFor(() => expect(resendBookInvitation).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'invitations.revoke' }));
    await waitFor(() => expect(revokeBookInvitation).toHaveBeenCalled());
  });
});
