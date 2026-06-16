import { type ChangeEvent } from 'react';

import { Button, Input, Modal } from '@do-epub-studio/ui';

import { useTranslation } from '../../../hooks/useTranslation';
import { GRANT_MODES } from './types';
import type { Grant, GrantFormData } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GrantFormProps {
  isOpen: boolean;
  editingGrant: Grant | null;
  formData: GrantFormData;
  formErrors: Record<string, string>;
  isSubmitting: boolean;
  onChange: (data: GrantFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
          <Button variant="primary" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? t('grants.form.submitting')
              : editingGrant
                ? t('grants.actions.save')
                : t('grants.createGrant')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Email — read-only when editing */}
        <Input
          label={t('grants.form.email')}
          type="email"
          value={formData.email}
          onChange={(e) => onChange({ ...formData, email: e.target.value })}
          error={formErrors.email}
          disabled={editingGrant !== null}
          required
        />

        {/* Password fields — create only */}
        {!editingGrant && (
          <>
            <Input
              label={t('grants.form.password')}
              type="password"
              value={formData.password}
              onChange={(e) => onChange({ ...formData, password: e.target.value })}
              error={formErrors.password}
              required
            />
            <Input
              label={t('grants.form.passwordConfirm')}
              type="password"
              value={formData.passwordConfirm}
              onChange={(e) =>
                onChange({ ...formData, passwordConfirm: e.target.value })
              }
              error={formErrors.passwordConfirm}
              required
            />
          </>
        )}

        {/* Grant mode */}
        <div>
          <label className="block text-sm font-medium text-foreground-muted mb-1">
            {t('grants.form.mode')}
          </label>
          <select
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

        {/* Capability toggles */}
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
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

        {/* Expiry date */}
        <div>
          <label className="block text-sm font-medium text-foreground-muted mb-1">
            {t('grants.form.expiry')}
          </label>
          <input
            type="date"
            value={formData.expiresAt}
            onChange={(e) => onChange({ ...formData, expiresAt: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-accent focus:border-accent"
          />
          <p className="mt-1 text-xs text-foreground-muted">
            {t('grants.form.expiryHint')}
          </p>
        </div>

        {/* Submit-level error */}
        {formErrors.submit && (
          <div className="p-3 bg-semantic-error/10 border border-semantic-error/30 rounded text-sm text-semantic-error">
            {formErrors.submit}
          </div>
        )}
      </div>
    </Modal>
  );
}
