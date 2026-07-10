import { type ChangeEvent, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { Button, Input, Modal } from '@do-epub-studio/ui';

import { useTranslation } from '../../../hooks/useTranslation';
import { GRANT_MODES } from './types';
import type { Grant, GrantFormData } from './types';

interface GrantFormProps {
  isOpen: boolean;
  editingGrant: Grant | null;
  formData: GrantFormData;
  formErrors: Record<string, string>;
  isSubmitting: boolean;
  onChange: (data: GrantFormData) => void;
  onSubmit: ((formData: FormData) => void) | (() => void);
  onClose: () => void;
}

interface SubmitButtonProps {
  isEdit: boolean;
  children: ReactNode;
}

function SubmitButton({ isEdit, children }: SubmitButtonProps) {
  const { t } = useTranslation();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending
        ? t('grants.form.submitting')
        : children ?? (isEdit ? t('grants.actions.save') : t('grants.createGrant'))}
    </Button>
  );
}

export function GrantForm({
  isOpen,
  editingGrant,
  formData,
  formErrors,
  isSubmitting,
  onChange,
  onSubmit,
  onClose,
}: GrantFormProps) {
  const { t } = useTranslation();

  // React 19 form actions receive (formData); legacy handlers may take
  // no arguments. Detect the signature by calling with a no-arg probe.
  function handleFormAction(formData: FormData): void {
    if (onSubmit.length >= 1) {
      onSubmit(formData);
    } else {
      (onSubmit as () => void)();
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingGrant
          ? t('grants.editGrantTitle')
          : t('grants.createGrantTitle')
      }
      footer={
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('annotation.cancel')}
          </Button>
          <SubmitButton isEdit={editingGrant !== null}>
            {editingGrant ? t('grants.actions.save') : t('grants.createGrant')}
          </SubmitButton>
        </div>
      }
    >
      <form action={handleFormAction} className="space-y-4">
        <Input
          label={t('grants.form.email')}
          type="email"
          name="email" /* eslint-disable-line i18next/no-literal-string -- form field name */
          value={formData.email}
          onChange={(e) => onChange({ ...formData, email: e.target.value })}
          error={formErrors.email}
          readOnly={editingGrant !== null}
          required
        />

        {!editingGrant && (
          <>
            <Input
              label={t('grants.form.password')}
              type="password"
              name="password" /* eslint-disable-line i18next/no-literal-string -- form field name */
              value={formData.password}
              onChange={(e) => onChange({ ...formData, password: e.target.value })}
              error={formErrors.password}
              required
            />
            <Input
              label={t('grants.form.passwordConfirm')}
              type="password"
              name="passwordConfirm" /* eslint-disable-line i18next/no-literal-string -- form field name */
              value={formData.passwordConfirm}
              onChange={(e) =>
                onChange({ ...formData, passwordConfirm: e.target.value })
              }
              error={formErrors.passwordConfirm}
              required
            />
          </>
        )}

        <div>
          <label htmlFor="grant-mode" className="block text-sm font-medium text-foreground-muted mb-1">
            {t('grants.form.mode')}
          </label>
          <select
            id="grant-mode"
            name="mode"
            value={formData.mode}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              onChange({ ...formData, mode: e.target.value })
            }
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-accent focus:border-accent"
          >
            {GRANT_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="commentsAllowed"
              checked={formData.commentsAllowed}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...formData, commentsAllowed: e.target.checked })
              }
              className="h-4 w-4 text-accent border-border rounded focus:ring-accent"
            />
            <span className="text-sm text-foreground-muted">
              {t('grants.capabilities.comments')}
            </span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="offlineAllowed"
              checked={formData.offlineAllowed}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...formData, offlineAllowed: e.target.checked })
              }
              className="h-4 w-4 text-accent border-border rounded focus:ring-accent"
            />
            <span className="text-sm text-foreground-muted">
              {t('grants.capabilities.offline')}
            </span>
          </label>
        </div>

        <div>
          <label htmlFor="grant-expires" className="block text-sm font-medium text-foreground-muted mb-1">
            {t('grants.form.expiry')}
          </label>
          <input
            id="grant-expires"
            type="date"
            name="expiresAt"
            value={formData.expiresAt}
            onChange={(e) => onChange({ ...formData, expiresAt: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-accent focus:border-accent"
          />
          <p className="mt-1 text-xs text-foreground-muted">
            {t('grants.form.expiryHint')}
          </p>
        </div>

        {formErrors.submit && (
          <div className="p-3 bg-semantic-error/10 border border-semantic-error/30 rounded text-sm text-semantic-error">
            {formErrors.submit}
          </div>
        )}
      </form>
    </Modal>
  );
}
