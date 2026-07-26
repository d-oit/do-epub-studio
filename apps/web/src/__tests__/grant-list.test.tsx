import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrantList } from '../features/admin/components/GrantList';
import type { Grant } from '../features/admin/components/types';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@do-epub-studio/ui', () => ({
  Spinner: () => <div data-testid="spinner" />,
  Button: ({ children, onClick, variant }: Record<string, unknown>) => (
    <button data-variant={variant} onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}>
      {children as React.ReactNode}
    </button>
  ),
  Modal: ({ isOpen, children, title, footer }: Record<string, unknown>) =>
    isOpen ? (
      <div data-testid="modal">
        <h2>{title as string}</h2>
        {children as React.ReactNode}
        {footer as React.ReactNode}
      </div>
    ) : null,
}));

const makeGrant = (overrides: Partial<Grant> = {}): Grant => ({
  id: 'g1',
  email: 'reader@example.com',
  mode: 'private',
  commentsAllowed: false,
  offlineAllowed: false,
  expiresAt: null,
  createdAt: '2026-06-01T00:00:00Z',
  revokedAt: null,
  ...overrides,
});

const defaultProps = {
  grants: [] as Grant[],
  isLoadingGrants: false,
  selectedBookId: '',
  onEdit: vi.fn(),
  onRevoke: vi.fn(),
};

function renderList(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return { ...render(<GrantList {...props} />), props };
}

describe('GrantList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows select-book prompt when no book selected', () => {
    renderList({ selectedBookId: '' });
    expect(screen.getByText('grants.selectBookPrompt')).toBeInTheDocument();
  });

  it('shows spinner when loading', () => {
    renderList({ selectedBookId: 'book-1', isLoadingGrants: true });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows empty grants message', () => {
    renderList({ selectedBookId: 'book-1', grants: [] });
    expect(screen.getByText('grants.noGrants')).toBeInTheDocument();
  });

  it('renders grant table with grants', () => {
    const grants = [
      makeGrant({ id: 'g1', email: 'a@test.com', mode: 'private' }),
      makeGrant({ id: 'g2', email: 'b@test.com', mode: 'public' }),
    ];
    renderList({ selectedBookId: 'book-1', grants });
    expect(screen.getByText('a@test.com')).toBeInTheDocument();
    expect(screen.getByText('b@test.com')).toBeInTheDocument();
  });

  it('displays correct mode labels', () => {
    const grants = [makeGrant({ mode: 'password_protected' })];
    renderList({ selectedBookId: 'book-1', grants });
    expect(screen.getByText('Password Protected')).toBeInTheDocument();
  });

  it('shows active status badge for non-expired grants', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const grants = [makeGrant({ expiresAt: futureDate })];
    renderList({ selectedBookId: 'book-1', grants });
    expect(screen.getByText('grants.status.active')).toBeInTheDocument();
  });

  it('shows expired status badge for expired grants', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const grants = [makeGrant({ expiresAt: pastDate })];
    renderList({ selectedBookId: 'book-1', grants });
    expect(screen.getByText('grants.status.expired')).toBeInTheDocument();
  });

  it('shows revoked status badge for revoked grants', () => {
    const grants = [makeGrant({ revokedAt: '2026-06-15T00:00:00Z' })];
    renderList({ selectedBookId: 'book-1', grants });
    expect(screen.getByText('grants.status.revoked')).toBeInTheDocument();
  });

  it('shows comments capability badge', () => {
    const grants = [makeGrant({ commentsAllowed: true })];
    renderList({ selectedBookId: 'book-1', grants });
    expect(screen.getByText('grants.capabilities.comments')).toBeInTheDocument();
  });

  it('shows offline capability badge', () => {
    const grants = [makeGrant({ offlineAllowed: true })];
    renderList({ selectedBookId: 'book-1', grants });
    expect(screen.getByText('grants.capabilities.offline')).toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn();
    const grants = [makeGrant()];
    renderList({ selectedBookId: 'book-1', grants, onEdit });
    fireEvent.click(screen.getByText('grants.actions.edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(grants[0]);
  });

  it('opens revoke confirmation modal', () => {
    const grants = [makeGrant()];
    renderList({ selectedBookId: 'book-1', grants });
    fireEvent.click(screen.getByText('grants.actions.revoke'));
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('grants.revokeTitle')).toBeInTheDocument();
  });

  it('confirms revoke and calls onRevoke', () => {
    const onRevoke = vi.fn();
    const grants = [makeGrant({ id: 'g1', email: 'a@test.com' })];
    renderList({ selectedBookId: 'book-1', grants, onRevoke });
    fireEvent.click(screen.getByText('grants.actions.revoke'));
    // Find the danger button inside modal
    const dangerButtons = screen.getAllByText('grants.actions.revoke');
    const confirmBtn = dangerButtons.find(
      (btn) => btn.closest('[data-variant="danger"]') !== null,
    );
    if (confirmBtn) fireEvent.click(confirmBtn);
    expect(onRevoke).toHaveBeenCalledWith(grants[0]);
  });

  it('does not show edit/revoke for revoked grants', () => {
    const grants = [makeGrant({ revokedAt: '2026-06-15T00:00:00Z' })];
    renderList({ selectedBookId: 'book-1', grants });
    expect(screen.queryByText('grants.actions.edit')).not.toBeInTheDocument();
    expect(screen.queryByText('grants.actions.revoke')).not.toBeInTheDocument();
  });

  it('shows "never" for null expiry date', () => {
    const grants = [makeGrant({ expiresAt: null })];
    renderList({ selectedBookId: 'book-1', grants });
    expect(screen.getByText('grants.never')).toBeInTheDocument();
  });

  it('displays table headers', () => {
    renderList({ selectedBookId: 'book-1', grants: [makeGrant()] });
    expect(screen.getByText('grants.table.email')).toBeInTheDocument();
    expect(screen.getByText('grants.table.mode')).toBeInTheDocument();
    expect(screen.getByText('grants.table.capabilities')).toBeInTheDocument();
    expect(screen.getByText('grants.table.status')).toBeInTheDocument();
    expect(screen.getByText('grants.table.expiry')).toBeInTheDocument();
    expect(screen.getByText('grants.table.created')).toBeInTheDocument();
    expect(screen.getByText('grants.table.actions')).toBeInTheDocument();
  });
});
