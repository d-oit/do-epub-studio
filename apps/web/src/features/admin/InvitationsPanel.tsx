import { useCallback, useEffect, useState } from 'react';
import { Button, Input } from '../../components/ui';
import { Spinner } from '@do-epub-studio/ui';
import { useTranslation } from '../../hooks/useTranslation';
import type { TranslationKeys } from '../../i18n/en';
import { useAuthStore } from '../../stores/auth';
import {
  createBookInvitation,
  fetchBookInvitations,
  resendBookInvitation,
  revokeBookInvitation,
  type BookInvitation,
  type CreateBookInvitationInput,
  type InvitationRole,
} from '../../lib/api/invitations';

interface InvitationsPanelProps {
  bookId: string | undefined;
  executeWithStepUp: <T>(fn: (token: string) => Promise<T>, currentToken?: string) => Promise<T>;
}

const MODES = [
  'private',
  'password_protected',
  'reader_only',
  'editorial_review',
  'public',
] as const;
const READER_ROLE = 'reader';
const CREATOR_ROLE = 'creator';
type InvitationMode = (typeof MODES)[number];
const MODE_LABEL_KEYS: Record<InvitationMode, TranslationKeys> = {
  private: 'invitations.mode.private',
  password_protected: 'invitations.mode.password_protected',
  reader_only: 'invitations.mode.reader_only',
  editorial_review: 'invitations.mode.editorial_review',
  public: 'invitations.mode.public',
};

function formatExpiry(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.000Z`).toISOString() : undefined;
}

function statusKey(invitation: BookInvitation): TranslationKeys {
  if (invitation.status === 'accepted') return 'invitations.statusAccepted';
  if (invitation.status === 'revoked') return 'invitations.statusRevoked';
  if (invitation.status === 'expired') return 'invitations.statusExpired';
  if (invitation.status === 'failed') return 'invitations.statusFailed';
  return 'invitations.statusPending';
}

function deliveryKey(invitation: BookInvitation): TranslationKeys {
  if (invitation.deliveryStatus === 'sent') return 'invitations.deliverySent';
  if (invitation.deliveryStatus === 'manual_copy_required') return 'invitations.deliveryManual';
  if (invitation.deliveryStatus === 'failed') return 'invitations.deliveryFailed';
  return 'invitations.deliveryPending';
}

export function InvitationsPanel({
  bookId,
  executeWithStepUp,
}: InvitationsPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [invitations, setInvitations] = useState<BookInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyUrl, setCopyUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>(READER_ROLE);
  const [mode, setMode] = useState<InvitationMode>('private');
  const [commentsAllowed, setCommentsAllowed] = useState(false);
  const [offlineAllowed, setOfflineAllowed] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');

  const load = useCallback(async () => {
    if (!bookId || !sessionToken) return;
    setIsLoading(true);
    try {
      setInvitations(await fetchBookInvitations(bookId, sessionToken));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invitations.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [bookId, sessionToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!bookId) return null;

  const resetForm = () => {
    setEmail('');
    setRole(READER_ROLE);
    setMode('private');
    setCommentsAllowed(false);
    setOfflineAllowed(false);
    setExpiresAt('');
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    setCopyUrl(null);
    try {
      const input: Omit<CreateBookInvitationInput, 'bookId'> = {
        email: email.trim(),
        role,
        mode,
        commentsAllowed,
        offlineAllowed,
        ...(formatExpiry(expiresAt) ? { expiresAt: formatExpiry(expiresAt) } : {}),
      };
      const result = await executeWithStepUp(
        (stepUpToken) => createBookInvitation(bookId, input, stepUpToken),
        sessionToken ?? undefined,
      );
      setCopyUrl(result.copyUrl);
      setShowForm(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invitations.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (invitation: BookInvitation) => {
    if (!sessionToken) return;
    setIsSubmitting(true);
    setError(null);
    setCopyUrl(null);
    try {
      const result = await executeWithStepUp(
        (stepUpToken) => resendBookInvitation(bookId, invitation.id, stepUpToken),
        sessionToken,
      );
      setCopyUrl(result.copyUrl);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invitations.actionError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (invitation: BookInvitation) => {
    if (!sessionToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await executeWithStepUp(
        (stepUpToken) => revokeBookInvitation(bookId, invitation.id, stepUpToken),
        sessionToken,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invitations.actionError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!copyUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(copyUrl);
      setCopied(true);
    } catch {
      setError(t('invitations.actionError'));
    }
  };

  return (
    <section
      aria-labelledby="invitations-title"
      className="mt-6 rounded-sm border border-[var(--color-rule)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="invitations-title" className="font-display text-lg font-semibold">
            {t('invitations.adminTitle')}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">{t('invitations.adminDescription')}</p>
        </div>
        <Button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          aria-expanded={showForm}
        >
          {showForm ? t('invitations.closeForm') : t('invitations.invitePerson')}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--color-accent-error)]">
          {error}
        </p>
      )}

      {showForm && (
        <form
          className="mt-4 space-y-3 rounded-sm border border-border bg-background-secondary p-3"
          onSubmit={(event) => void handleCreate(event)}
        >
          <Input
            label={t('invitations.emailLabel')}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('invitations.roleLabel')}</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as InvitationRole)}
                className="min-h-11 w-full rounded-sm border border-border bg-background px-2"
              >
                <option value={READER_ROLE}>{t('invitations.roleReader')}</option>
                <option value={CREATOR_ROLE}>{t('invitations.roleCreator')}</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('invitations.modeLabel')}</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as InvitationMode)}
                className="min-h-11 w-full rounded-sm border border-border bg-background px-2"
              >
                {MODES.map((value) => (
                  <option key={value} value={value}>
                    {t(MODE_LABEL_KEYS[value])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={commentsAllowed}
                onChange={(event) => setCommentsAllowed(event.target.checked)}
              />
              {t('grants.capabilities.comments')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={offlineAllowed}
                onChange={(event) => setOfflineAllowed(event.target.checked)}
              />
              {t('grants.capabilities.offline')}
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('invitations.expiryLabel')}</span>
            <input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="min-h-11 w-full rounded-sm border border-border bg-background px-2"
            />
          </label>
          <Button
            type="submit"
            isLoading={isSubmitting}
            loadingLabel={t('invitations.sending')}
            disabled={!email.trim()}
          >
            {t('invitations.sendInvite')}
          </Button>
        </form>
      )}

      {copyUrl && (
        <div
          className="mt-4 rounded-sm border border-border bg-background-secondary p-3"
          role="status"
        >
          <p className="text-sm">{t('invitations.manualDelivery')}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={copyUrl}
              aria-label={t('invitations.copyLinkLabel')}
              className="min-h-11 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-sm"
            />
            <Button type="button" onClick={() => void handleCopy()} disabled={!navigator.clipboard}>
              {copied ? t('invitations.copied') : t('invitations.copyLink')}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="mt-4 flex justify-center" role="status" aria-label={t('a11y.loading_page')}>
          <Spinner label={t('a11y.loading_page')} />
        </div>
      ) : invitations.length === 0 ? (
        <p className="mt-4 text-sm text-foreground-muted">{t('invitations.empty')}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="rounded-sm border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{invitation.email}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {t(
                      invitation.role === 'creator'
                        ? 'invitations.roleCreator'
                        : 'invitations.roleReader',
                    )}
                    {' · '}
                    {t(statusKey(invitation))} · {t(deliveryKey(invitation))}
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  {(invitation.status === 'pending' ||
                    invitation.status === 'failed' ||
                    invitation.status === 'expired') && (
                    <button
                      type="button"
                      className="min-h-11 underline underline-offset-2"
                      disabled={isSubmitting}
                      onClick={() => void handleResend(invitation)}
                    >
                      {t('invitations.resend')}
                    </button>
                  )}
                  {(invitation.status === 'pending' ||
                    invitation.status === 'processing' ||
                    invitation.status === 'accepted') && (
                    <button
                      type="button"
                      className="min-h-11 text-[var(--color-accent-error)] underline underline-offset-2"
                      disabled={isSubmitting}
                      onClick={() => void handleRevoke(invitation)}
                    >
                      {t('invitations.revoke')}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
