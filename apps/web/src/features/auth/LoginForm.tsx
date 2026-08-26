import React from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { Button, Input } from '../../components/ui';

export interface FormAction {
  (fd: FormData): void;
}

export interface LoginFormRefs {
  emailRef: React.RefObject<HTMLInputElement | null>;
  passwordRef: React.RefObject<HTMLInputElement | null>;
}

function SubmitButton({ children, loadingLabel, disabled }: { children: React.ReactNode; loadingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={disabled} isLoading={pending} loadingLabel={loadingLabel}>
      {children}
    </Button>
  );
}

export function LoginForm({ action, onRecovery, emailRef, passwordRef, noBookContext }: { action: FormAction; onRecovery: () => void; noBookContext?: boolean } & LoginFormRefs) {
  const { t } = useTranslation();
  return (
    <form action={action} noValidate>
      {noBookContext && (
        <p role="status" className="mb-5 rounded-lg border border-accent-warning/30 bg-accent-warning/10 px-3 py-2.5 text-sm leading-relaxed text-foreground-muted">
          {t('login.noBookContext')}
        </p>
      )}
      <div className="space-y-4">
        <Input
          ref={emailRef}
          id="email"
          label={t('login.emailLabel')}
          type="email"
          name="email" /* eslint-disable-line i18next/no-literal-string -- form field name */
          autoComplete="email"
          inputMode="email"
          required
          placeholder={t('login.emailPlaceholder')}
        />

        <div>
          <Input
            ref={passwordRef}
            id="password"
            label={t('login.passwordLabel')}
            type="password"
            name="password" /* eslint-disable-line i18next/no-literal-string -- form field name */
            autoComplete="current-password"
            placeholder={t('login.passwordPlaceholder')}
            showPasswordLabel={t('ui.showPassword')}
            hidePasswordLabel={t('ui.hidePassword')}
          />
          <button
            type="button"
            onClick={onRecovery}
            className="mt-1 text-xs text-accent hover:opacity-80 underline underline-offset-2 transition-colors"
          >
            {t('login.forgotPassword')}
          </button>
        </div>

        <SubmitButton loadingLabel={t('login.signingIn')} disabled={noBookContext}>
          {t('login.submit')}
        </SubmitButton>
      </div>
    </form>
  );
}

export function RecoveryForm({ action, onBack }: { action: FormAction; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <form action={action}>
      <div className="space-y-4">
        <p className="text-sm text-foreground-muted mb-4">
          {t('login.recoveryInstructions')}
        </p>
        <Input
          id="email"
          label={t('login.emailLabel')}
          type="email"
          name="email" /* eslint-disable-line i18next/no-literal-string -- form field name */
          required
          autoComplete="email"
        />

        <SubmitButton loadingLabel={t('login.signingIn')}>
          {t('login.sendMagicLink')}
        </SubmitButton>

        <div className="text-center mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
          >
            {t('login.backToLogin')}
          </Button>
        </div>
      </div>
    </form>
  );
}
