import { useTranslation } from '../../hooks/useTranslation';
import { Button, Input } from '../../components/ui';

export function MfaFactorChooser({
  isLoading,
  onPasskey,
  onRecovery,
}: {
  isLoading: boolean;
  onPasskey: () => void;
  onRecovery: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="w-full"
        isLoading={isLoading}
        loadingLabel={t('admin.login.signingIn')}
        onClick={onPasskey}
      >
        {t('admin.login.usePasskey')}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={isLoading}
        onClick={onRecovery}
      >
        {t('admin.login.useRecoveryCode')}
      </Button>
    </div>
  );
}

export interface RecoveryFormProps {
  recoveryEmail: string;
  recoveryPassword: string;
  recoveryCode: string;
  isLoading: boolean;
  onRecoveryPasswordChange: (value: string) => void;
  onRecoveryCodeChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export function AdminRecoveryForm({
  recoveryEmail,
  recoveryPassword,
  recoveryCode,
  isLoading,
  onRecoveryPasswordChange,
  onRecoveryCodeChange,
  onSubmit,
  onBack,
}: RecoveryFormProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4">
        <Input
          id="recovery-email"
          label={t('admin.login.email')}
          type="email"
          required
          autoComplete="email"
          value={recoveryEmail}
          readOnly
        />

        <Input
          id="recovery-password"
          label={t('admin.login.password')}
          type="password"
          required
          autoComplete="current-password"
          value={recoveryPassword}
          onChange={(e) => onRecoveryPasswordChange(e.target.value)}
          showPasswordLabel={t('ui.showPassword')}
          hidePasswordLabel={t('ui.hidePassword')}
        />

        <Input
          id="recovery-code"
          label={t('admin.login.recoveryCode')}
          type="text"
          required
          autoComplete="one-time-code"
          value={recoveryCode}
          onChange={(e) => onRecoveryCodeChange(e.target.value)}
        />

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
          loadingLabel={t('admin.login.signingIn')}
        >
          {t('admin.login.verifyRecovery')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={onBack}
          disabled={isLoading}
        >
          {t('admin.login.back')}
        </Button>
      </div>
    </form>
  );
}
