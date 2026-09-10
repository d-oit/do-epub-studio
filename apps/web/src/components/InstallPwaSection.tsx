import { useTranslation } from '../hooks/useTranslation';
import { usePwaInstallStore } from '../stores/pwa-install';
import { promptInstall } from '../lib/pwa-install';
import { APP_NAME } from '../config/app-identity';
import { Button } from './ui';

/**
 * Settings row offering the browser's native install prompt.
 *
 * Renders nothing when the browser never offered an install event
 * (unsupported), the app is already installed/standalone, or the user
 * dismissed the prompt this session — never a disabled button or an in-app
 * fake prompt. Dismissal is session-only, in memory; no storage key.
 */
export function InstallPwaSection() {
  const { t } = useTranslation();
  const canPrompt = usePwaInstallStore((s) => s.canPrompt);
  const installed = usePwaInstallStore((s) => s.installed);
  const dismissed = usePwaInstallStore((s) => s.dismissed);

  if (!canPrompt || installed || dismissed) return null;

  const handleInstall = async () => {
    const outcome = await promptInstall();
    // 'accepted' → the browser fires appinstalled, flips `installed`, and
    // this row unmounts. 'unavailable' → canPrompt is already false.
    if (outcome === 'dismissed') usePwaInstallStore.getState().setDismissed();
  };

  return (
    <section className="bg-background-secondary rounded-xl border border-border p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-2">{t('settings.install.title')}</h2>
      <p className="text-sm text-foreground-muted mb-4">
        {t('settings.install.description', { app: APP_NAME })}
      </p>
      <Button variant="secondary" onClick={() => { void handleInstall(); }}>
        {t('settings.install.action')}
      </Button>
    </section>
  );
}
