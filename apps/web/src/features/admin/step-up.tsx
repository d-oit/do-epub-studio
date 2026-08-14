import { useCallback, useRef, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Button, Input, Modal } from '../../components/ui';
import { performPasskeyAuth, isMfaRequired } from './mfa';

/** Error shape surfaced by apiRequest for a !ok response (see lib/api/core.ts). */
export interface ApiError extends Error {
  code?: string;
  status?: number;
}

/** True when the server requires step-up (428 STEP_UP_REQUIRED) before a guarded mutation. */
export function isStepUpRequired(err: unknown): boolean {
  return (err as ApiError)?.code === 'STEP_UP_REQUIRED';
}

/**
 * Calls POST /api/admin/account/step-up with the current password and REPLACES
 * the stored session token with the rotated (step-up) bearer token so that
 * subsequent guarded mutations use it. Returns the new token.
 */
export async function performStepUp(password: string): Promise<string> {
  const sessionToken = useAuthStore.getState().sessionToken;
  const data = await apiRequest<{ token: string }>('/api/admin/account/step-up', {
    method: 'POST',
    token: sessionToken ?? undefined,
    body: JSON.stringify({ currentPassword: password }),
  });
  useAuthStore.getState().refreshSession({ sessionToken: data.token });
  return data.token;
}

interface PendingAction<T> {
  execute: (token: string) => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export interface AdminStepUp {
  /**
   * Runs a guarded mutation with the current bearer token. If the worker
   * responds with 428 STEP_UP_REQUIRED, a modal prompts for the current
   * password, the session token is rotated, and the mutation is retried once
   * with the new token. Resolves with the mutation result; rejects if the
   * mutation fails for any non-step-up reason or the user cancels.
   */
  execute: <T>(fn: (token: string) => Promise<T>, currentToken?: string) => Promise<T>;
  /** Render the step-up modal (mount once near the page root). */
  modal: React.ReactElement | null;
}

/**
 * Step-up authentication for guarded admin mutations. Returns an `execute`
 * wrapper that transparently handles 428 STEP_UP_REQUIRED by prompting for the
 * current password, rotating the session token, and retrying the mutation.
 */
export function useAdminStepUp(): AdminStepUp {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingAction<unknown> | null>(null);

  const execute = useCallback(<T,>(fn: (token: string) => Promise<T>, currentToken?: string): Promise<T> => {
    const token = currentToken ?? useAuthStore.getState().sessionToken ?? '';
    return fn(token).catch((err: unknown) => {
      // 428 MFA_REQUIRED: the guarded mutation needs `mfa` assurance, so run
      // the passkey ceremony (native browser prompt) and retry with the
      // rotated token. No password modal is needed for this path.
      if (isMfaRequired(err)) {
        return performPasskeyAuth().then((newToken) => fn(newToken));
      }
      if (!isStepUpRequired(err)) throw err;
      return new Promise<T>((resolve, reject) => {
        pendingRef.current = {
          execute: fn,
          resolve: resolve as (value: unknown) => void,
          reject,
        };
        setPassword('');
        setError(null);
        setIsOpen(true);
      });
    });
  }, []);

  const handleConfirm = async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const newToken = await performStepUp(password);
      const result = await pending.execute(newToken);
      pending.resolve(result);
      pendingRef.current = null;
      setIsOpen(false);
    } catch (err) {
      setError((err as Error).message || t('admin.stepUp.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (pendingRef.current) pendingRef.current.reject(new Error('cancelled'));
    pendingRef.current = null;
    setIsOpen(false);
  };

  const modal = (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={t('admin.stepUp.title')}
      description={t('admin.stepUp.description')}
      footer={
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
            {t('admin.stepUp.cancel')}
          </Button>
          <Button onClick={() => { void handleConfirm(); }} isLoading={isSubmitting} loadingLabel={t('admin.stepUp.submitting')}>
            {t('admin.stepUp.confirm')}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); void handleConfirm(); }}
        className="space-y-4"
      >
        {error && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}
        <Input
          id="step-up-password"
          type="password"
          label={t('admin.stepUp.currentPassword')}
          value={password}
          onChange={(e) => { setPassword(e.target.value); }}
          autoComplete="current-password"
          required
        />
      </form>
    </Modal>
  );

  return { execute, modal };
}
