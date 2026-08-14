import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Button, Input, Modal, ConfirmDialog } from '../../components/ui';
import { useAdminStepUp } from './step-up';
import {
  fetchMfaStatus,
  performPasskeyAuth,
  performPasskeyEnroll,
  regenerateRecoveryCodes,
  removePasskey,
  type AdminMfaStatus,
} from './mfa';

type PasswordAction = 'enroll' | 'remove' | 'regenerate' | null;

/**
 * Admin "Security / MFA" section (ADR-234 items 5+6). Handles passkey
 * enrollment/removal, session step-up to `mfa` assurance, and single-use
 * recovery-code generation. Recovery codes are shown once after the call that
 * created them. Guarded mutations flow through `useAdminStepUp`, which
 * transparently handles 428 STEP_UP_REQUIRED (password) and 428 MFA_REQUIRED
 * (passkey ceremony).
 */
export function MfaSection() {
  const { t } = useTranslation();
  const stepUp = useAdminStepUp();

  const [status, setStatus] = useState<AdminMfaStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordAction, setPasswordAction] = useState<PasswordAction>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [removePending, setRemovePending] = useState<{ id: string; name: string } | null>(null);
  const [displayName, setDisplayName] = useState('');

  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setStatus(await fetchMfaStatus());
    } catch {
      setLoadError(t('security.mfa.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const closePassword = () => {
    setPasswordOpen(false);
    setPassword('');
    setDisplayName('');
    setPendingRemoveId(null);
    setPasswordAction(null);
  };

  const openPassword = (action: Exclude<PasswordAction, null>, removeId?: string) => {
    setError(null);
    setPassword('');
    setDisplayName('');
    setPendingRemoveId(removeId ?? null);
    setPasswordAction(action);
    setPasswordOpen(true);
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
    } catch {
      // Clipboard unavailable; no-op.
    }
  };

  const copyAll = async () => {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopiedAll(true);
    } catch {
      // no-op
    }
  };

  const handlePasswordConfirm = async () => {
    if (!passwordAction) return;
    setIsBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (passwordAction === 'enroll') {
        const result = await stepUp.execute((_tok) => performPasskeyEnroll(password, displayName || undefined));
        await load();
        if (result.recoveryCodes && result.recoveryCodes.length > 0) {
          setRecoveryCodes(result.recoveryCodes);
        } else {
          setInfo(t('security.mfa.enrollSuccess'));
        }
      } else if (passwordAction === 'remove' && pendingRemoveId) {
        await stepUp.execute((_tok) => removePasskey(pendingRemoveId, password));
        await load();
        setInfo(t('security.mfa.removeSuccess'));
        if (!status?.mfaEnrolled || status.passkeys.length <= 1) {
          setRecoveryCodes(null);
        }
      } else if (passwordAction === 'regenerate') {
        const result = await stepUp.execute((_tok) => regenerateRecoveryCodes(password));
        setRecoveryCodes(result.recoveryCodes);
      }
      closePassword();
    } catch {
      setError(t('security.mfa.actionFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleAuthenticate = async () => {
    setIsBusy(true);
    setError(null);
    setInfo(null);
    try {
      await performPasskeyAuth();
      setInfo(t('security.mfa.authSuccess'));
    } catch {
      setError(t('security.mfa.authFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  const enrolled = Boolean(status?.mfaEnrolled);

  return (
    <section className="rounded-xl border border-border bg-background-secondary p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{t('security.mfa.title')}</h2>
      <p className="mb-4 text-sm text-foreground-muted">{t('security.mfa.description')}</p>

      {loadError && (
        <p role="alert" className="mb-4 rounded bg-accent-error/10 border border-accent-error/20 p-3 text-sm text-accent-error">
          {loadError}
        </p>
      )}

      {info && (
        <p role="status" className="mb-4 rounded bg-accent/10 border border-accent/20 p-3 text-sm text-accent">
          {info}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded bg-accent-error/10 border border-accent-error/20 p-3 text-sm text-accent-error">
          {error}
        </p>
      )}

      <div className="mb-6 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('security.mfa.passkeys')}</h3>
        {status === null && !loadError && (
          <p role="status" className="text-sm text-foreground-muted">{t('security.mfa.loading')}</p>
        )}
        {status && status.passkeys.length === 0 && (
          <p className="text-sm text-foreground-muted">{t('security.mfa.noEnrolled')}</p>
        )}
        <ul className="space-y-2">
          {status?.passkeys.map((passkey) => {
            const name = passkey.displayName || passkey.id.slice(0, 8);
            return (
              <li key={passkey.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
                <span className="text-foreground">{name}</span>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={isBusy}
                  aria-label={`${t('security.mfa.remove')} ${name}`}
                  onClick={() => { setRemovePending({ id: passkey.id, name }); }}
                >
                  {t('security.mfa.remove')}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3">
        {!enrolled ? (
          <Button onClick={() => { openPassword('enroll'); }} disabled={isBusy}>
            {t('security.mfa.enroll')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => { openPassword('enroll'); }} disabled={isBusy}>
            {t('security.mfa.addAnother')}
          </Button>
        )}
        {enrolled && (
          <Button variant="secondary" onClick={() => { void handleAuthenticate(); }} isLoading={isBusy} loadingLabel={t('security.mfa.authenticating')}>
            {t('security.mfa.authenticate')}
          </Button>
        )}
        {enrolled && (
          <Button variant="secondary" onClick={() => { openPassword('regenerate'); }} disabled={isBusy} isLoading={isBusy} loadingLabel={t('security.mfa.regenerating')}>
            {t('security.mfa.regenerate')}
          </Button>
        )}
      </div>
      {enrolled && (
        <p className="mt-3 text-xs text-foreground-muted">{t('security.mfa.stepUpNeeded')}</p>
      )}

      {recoveryCodes && recoveryCodes.length > 0 && (
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">{t('security.recovery.recoveryCodes')}</h3>
            <div className="flex gap-2">
              {copiedAll && <span className="text-xs text-accent">{t('security.recovery.copied')}</span>}
              <Button variant="ghost" size="sm" onClick={() => { void copyAll(); }}>
                {t('security.recovery.copyAll')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRecoveryCodes(null)}>
                {t('security.recovery.close')}
              </Button>
            </div>
          </div>
          <p role="alert" className="mb-3 rounded bg-accent-error/10 border border-accent-error/20 p-3 text-sm text-accent-error">
            {t('security.recovery.recoveryCodesWarning')}
          </p>
          <p className="mb-3 text-xs text-foreground-muted">{t('security.recovery.codesShownOnce')}</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recoveryCodes.map((code) => (
              <li key={code} className="flex items-center justify-between rounded border border-border bg-background px-3 py-2 font-mono text-sm">
                <span>{code}</span>
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() => { void copy(code, code); }}
                >
                  {copiedKey === code ? t('security.recovery.codeCopied') : t('security.recovery.copy')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        isOpen={passwordOpen}
        onClose={closePassword}
        title={t('security.mfa.title')}
        description={t('admin.stepUp.description')}
        footer={
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={closePassword} disabled={isBusy}>
              {t('admin.stepUp.cancel')}
            </Button>
            <Button onClick={() => { void handlePasswordConfirm(); }} isLoading={isBusy} loadingLabel={t('admin.stepUp.submitting')}>
              {t('admin.stepUp.confirm')}
            </Button>
          </div>
        }
      >
        <form
          onSubmit={(e) => { e.preventDefault(); void handlePasswordConfirm(); }}
          className="space-y-4"
        >
          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
          <Input
            id="mfa-password"
            type="password"
            label={t('admin.stepUp.currentPassword')}
            value={password}
            onChange={(e) => { setPassword(e.target.value); }}
            autoComplete="current-password"
            required
          />
          {passwordAction === 'enroll' && (
            <Input
              id="mfa-display-name"
              type="text"
              label={t('security.mfa.passkeyName')}
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); }}
              autoComplete="off"
            />
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={removePending !== null}
        title={t('security.mfa.removeConfirmTitle')}
        description={removePending ? t('security.mfa.removeConfirmMessage', { name: removePending.name }) : undefined}
        variant="danger"
        confirmLabel={t('security.mfa.remove')}
        cancelLabel={t('admin.stepUp.cancel')}
        onConfirm={() => {
          if (removePending) openPassword('remove', removePending.id);
          setRemovePending(null);
        }}
        onCancel={() => setRemovePending(null)}
      />

      {stepUp.modal}
    </section>
  );
}
