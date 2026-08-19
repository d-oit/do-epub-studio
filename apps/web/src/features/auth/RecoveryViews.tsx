import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../../components/ui';

export function RecoverySuccessView({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="text-center">
      <div className="mb-6 p-4 bg-accent-success/10 border border-accent-success/20 rounded text-sm text-accent-success">
        {t('login.recoverySuccess')}
      </div>
      <Button
        variant="ghost"
        onClick={onBack}
      >
        {t('login.backToLogin')}
      </Button>
    </div>
  );
}

export function TokenVerifyingView() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-background-secondary rounded-xl shadow-lg p-8 text-center">
        <p className="text-foreground-muted">{t('login.verifyingToken')}</p>
      </div>
    </div>
  );
}

export function TokenErrorView({ error }: { error: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-background-secondary rounded-xl shadow-lg p-8 text-center space-y-4">
        <p className="text-accent-error" role="alert">{error}</p>
        <Button
          onClick={() => {
            // eslint-disable-next-line i18next/no-literal-string -- route path
            void navigate('/login');
          }}
        >
          {t('login.backToLogin')}
        </Button>
      </div>
    </div>
  );
}
